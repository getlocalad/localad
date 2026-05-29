import { Router } from 'express';
import Stripe from 'stripe';
import { pool } from '../db/db.js';
import { sendSubscriptionConfirmMail } from '../services/mailer.js';

export const stripeRouter = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ── POST /api/stripe/webhook ──────────────────────────────────────────────────
// Raw body wird in server.js via express.raw() vor diesem Router gesetzt
stripeRouter.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[Stripe] Webhook-Signatur ungueltig:', err.message);
    return res.status(400).send('Webhook Error: ' + err.message);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutCompleted(event.data.object);
        break;
      }
      case 'invoice.paid': {
        await handleInvoicePaid(event.data.object);
        break;
      }
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused': {
        await handleSubscriptionEnded(event.data.object);
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[Stripe] Webhook-Verarbeitung fehlgeschlagen:', err.message);
    res.status(500).json({ error: 'Verarbeitungsfehler' });
  }
});

// ── POST /api/stripe/create-checkout ─────────────────────────────────────────
stripeRouter.post('/create-checkout', async (req, res, next) => {
  try {
    const { userId, email } = req.body;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: process.env.STRIPE_PRICE_USER_MONTHLY, quantity: 1 }],
      metadata: { userId },
      success_url: process.env.DASHBOARD_URL + '/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url:  process.env.DASHBOARD_URL + '/cancel',
    });
    res.json({ checkoutUrl: session.url });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/stripe/create-advertiser-checkout ───────────────────────────────
stripeRouter.post('/create-advertiser-checkout', async (req, res, next) => {
  try {
    const { advertiserId, email, plan } = req.body;
    const priceMap = {
      basic:    process.env.STRIPE_PRICE_ADVERTISER_BASIC,
      standard: process.env.STRIPE_PRICE_ADVERTISER_STANDARD,
      premium:  process.env.STRIPE_PRICE_ADVERTISER_PREMIUM,
    };
    if (!priceMap[plan]) {
      return res.status(400).json({ error: 'Ungültiger Plan' });
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: priceMap[plan], quantity: 1 }],
      metadata: { advertiserId, plan },
      success_url: process.env.DASHBOARD_URL + '/advertiser/success',
      cancel_url:  process.env.DASHBOARD_URL + '/advertiser/cancel',
    });
    res.json({ checkoutUrl: session.url });
  } catch (err) {
    next(err);
  }
});

// ── Handler ───────────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session) {
  const userId       = session.metadata?.userId;
  const advertiserId = session.metadata?.advertiserId;
  const customerId   = session.customer;
  const subscriptionId = session.subscription;

  if (userId) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const subscriptionEnd = new Date(sub.current_period_end * 1000);
    await pool.query(
      `UPDATE users
       SET is_subscribed = TRUE, subscription_end = $1, stripe_customer_id = $2, updated_at = NOW()
       WHERE id = $3`,
      [subscriptionEnd, customerId, userId]
    );
    console.log('[Stripe] User ' + userId + ' Abo aktiviert bis ' + subscriptionEnd.toISOString());
    const userRow = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    if (userRow.rows[0]?.email) {
      sendSubscriptionConfirmMail(userRow.rows[0].email, subscriptionEnd).catch(() => {});
    }
  }

  if (advertiserId) {
    const plan = session.metadata.plan;
    const sub  = await stripe.subscriptions.retrieve(subscriptionId);
    const subscriptionEnd = new Date(sub.current_period_end * 1000);
    await pool.query(
      `UPDATE advertisers
       SET is_active = TRUE, plan = $1, subscription_end = $2, stripe_customer_id = $3, updated_at = NOW()
       WHERE id = $4`,
      [plan, subscriptionEnd, customerId, advertiserId]
    );
    // Extension-Abo für Werbetreibende inklusive: is_subscribed = TRUE setzen
    await pool.query(
      `UPDATE users SET is_subscribed = TRUE, stripe_customer_id = $1, updated_at = NOW()
       WHERE id = (SELECT user_id FROM advertisers WHERE id = $2)`,
      [customerId, advertiserId]
    );
    console.log('[Stripe] Advertiser ' + advertiserId + ' Abo aktiviert (Plan: ' + plan + ') – Extension inklusive');
  }
}

async function handleInvoicePaid(invoice) {
  const customerId = invoice.customer;
  const sub = await stripe.subscriptions.retrieve(invoice.subscription);
  const subscriptionEnd = new Date(sub.current_period_end * 1000);
  await pool.query(
    'UPDATE users SET subscription_end = $1, updated_at = NOW() WHERE stripe_customer_id = $2',
    [subscriptionEnd, customerId]
  );
  await pool.query(
    'UPDATE advertisers SET subscription_end = $1, updated_at = NOW() WHERE stripe_customer_id = $2',
    [subscriptionEnd, customerId]
  );
}

async function handleSubscriptionEnded(subscription) {
  const customerId = subscription.customer;
  await pool.query(
    'UPDATE users SET is_subscribed = FALSE, updated_at = NOW() WHERE stripe_customer_id = $1',
    [customerId]
  );
  await pool.query(
    'UPDATE advertisers SET is_active = FALSE, updated_at = NOW() WHERE stripe_customer_id = $1',
    [customerId]
  );
  console.log('[Stripe] Abo beendet fuer Customer ' + customerId);
}
