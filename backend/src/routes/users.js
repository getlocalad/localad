import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../db/db.js';
import Stripe from 'stripe';

export const usersRouter = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ── GET /api/users/me ─────────────────────────────────────────────────────────
usersRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, email, postal_code, is_subscribed, subscription_end, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User nicht gefunden' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/users/me ───────────────────────────────────────────────────────
// Body: { postalCode }
usersRouter.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const { postalCode } = req.body;
    if (!postalCode || !/^\d{5}$/.test(postalCode)) {
      return res.status(400).json({ error: 'Ungültige PLZ (5 Ziffern erforderlich)' });
    }
    await pool.query(
      'UPDATE users SET postal_code = $1, updated_at = NOW() WHERE id = $2',
      [postalCode, req.user.id]
    );
    res.json({ ok: true, postalCode });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/users/cancel-subscription ──────────────────────────────────────
usersRouter.post('/cancel-subscription', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User nicht gefunden' });
    if (!user.stripe_customer_id) {
      return res.status(400).json({ error: 'Kein aktives Abo gefunden' });
    }

    // Alle aktiven Subscriptions des Customers holen
    const subs = await stripe.subscriptions.list({
      customer: user.stripe_customer_id,
      status: 'active',
      limit: 1,
    });

    if (!subs.data.length) {
      return res.status(400).json({ error: 'Keine aktive Subscription bei Stripe' });
    }

    // Zum Periodenende kündigen (nicht sofort)
    await stripe.subscriptions.update(subs.data[0].id, {
      cancel_at_period_end: true,
    });

    res.json({
      ok: true,
      message: 'Abo wird zum Ende der aktuellen Periode gekündigt',
      cancelAt: new Date(subs.data[0].current_period_end * 1000).toISOString(),
    });
  } catch (err) {
    next(err);
  }
});
