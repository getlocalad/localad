import { Router } from 'express';
import Stripe from 'stripe';
import { pool } from '../db/db.js';

export const stripeRouter = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ── POST /api/stripe/webhook ──────────────────────────────────────────────────
// WICHTIG: Raw body erforderlich für Signatur-Verifikation
// In server.js vor express.json() mounten mit express.raw({ type: 'application/json' })
stripeRouter.post(
  '/webhook',
  express_raw_middleware, // Platzhalter – siehe Hinweis unten
  async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('[Stripe] Webhook-Signatur ungültig:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {

        // Nutzer hat Checkout abgeschlossen → Abo aktivieren
        case 'checkout.session.completed': {
          const session = event.data.object;
          await handleCheckoutCompleted(session);
          break;
        }

        // Abo verlängert → subscription_end aktualisieren
        case 'invoice.paid': {
          const invoice = event.data.object;
          await handleInvoicePaid(invoice);
          break;
        }

        // Abo gekündigt oder Zahlung fehlgeschlagen → deaktivieren
        case 'customer.subscription.deleted':
        case 'customer.subscription.paused': {
          const subscription = event.data.object;
          await handleSubscriptionEnded(subscription);
          break;
        }

        default:
          // Unbekannte Events ignorieren
          break;
      }

      res.json({ received: true });
    } catch (err) {
      console.error('[Stripe] Webhook-Verarbeitung fehlgeschlagen:', err.message);
      res.status(500).json({ error: 'Verarbeitungsfehler' });
    }
  }
);

// ── POST /api/stripe/create-checkout ─────────────────────────────────────────
// Erstellt eine Stripe Checkout Session für Endnutzer-Abo
stripeRouter.post('/create-checkout', async (req, res, next) => {
  try {
    const { userId, email } = req.body;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_USER_MONTHLY,
          quantity: 1,
        },
      ],
      metadata: { userId },
      success_url: `${process.env.DASHBOARD_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.DASHBOARD_URL}/cancel`,
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
      success_url: `${process.env.DASHBOARD_URL}/advertiser/success`,
      cancel_url:  `${process.env.DASHBOARD_URL}/advertiser/cancel`,
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
    // Endnutzer-Abo aktivieren
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const subscriptionEnd = new Date(sub.current_period_end * 1000);

    await pool.query(
      `UPDATE users
       SET is_subscribed = TRUE, subscription_end = $1, stripe_customer_id = $2, updated_at = NOW()
       WHERE id = $3`,
      [subscriptionEnd, customerId, userId]
    );
    console.log(`[Stripe] User ${userId} Abo aktiviert bis ${subscriptionEnd.toISOString()}`);
  }

  if (advertiserId) {
    // Werbetreibenden-Abo aktivieren
    const plan = session.metadata.plan;
    const sub  = await stripe.subscriptions.retrieve(subscriptionId);
    const subscriptionEnd = new Date(sub.current_period_end * 1000);

    await pool.query(
      `UPDATE advertisers
       SET is_active = TRUE, plan = $1, subscription_end = $2, stripe_customer_id = $3, updated_at = NOW()
       WHERE id = $4`,
      [plan, subscriptionEnd, customerId, advertiserId]
    );
    console.log(`[Stripe] Advertiser ${advertiserId} Abo aktiviert (Plan: ${plan})`);
  }
}

async function handleInvoicePaid(invoice) {
  const customerId   = invoice.customer;
  const subscriptionId = invoice.subscription;
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const subscriptionEnd = new Date(sub.current_period_end * 1000);

  // User oder Advertiser anhand stripe_customer_id aktualisieren
  await pool.query(
    `UPDATE users SET subscription_end = $1, updated_at = NOW() WHERE stripe_customer_id = $2`,
    [subscriptionEnd, customerId]
  );
  await pool.query(
    `UPDATE advertisers SET subscription_end = $1, updated_at = NOW() WHERE stripe_customer_id = $2`,
    [subscriptionEnd, customerId]
  );
}

async function handleSubscriptionEnded(subscription) {
  const customerId = subscription.customer;

  await pool.query(
    `UPDATE users SET is_subscribed = FALSE, updated_at = NOW() WHERE stripe_customer_id = $1`,
    [customerId]
  );
  await pool.query(
    `UPDATE advertisers SET is_active = FALSE, updated_at = NOW() WHERE stripe_customer_id = $1`,
    [customerId]
  );
  console.log(`[Stripe] Abo beendet für Customer ${customerId}`);
}

// Exportierter Middleware-Name damit server.js ihn direkt nutzen kann
export function stripeRawBodyMiddleware(req, res, next) {
  // Diese Middleware muss in server.js VOR express.json() für /api/stripe/webhook registriert werden
  // Beispiel: app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeRouter)
  next();
}

// Interner Platzhalter – wird in server.js durch express.raw ersetzt
function express_raw_middleware(req, res, next) { next(); }
