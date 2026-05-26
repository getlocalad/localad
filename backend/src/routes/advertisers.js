import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../db/db.js';

export const advertisersRouter = Router();

// ── GET /api/advertisers/me ───────────────────────────────────────────────────
advertisersRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, company_name, contact_email, postal_code, plan, is_active, subscription_end
       FROM advertisers WHERE user_id = $1`,
      [req.user.id]
    );
    res.json({ advertiser: result.rows[0] ?? null });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/advertisers/me/stats ────────────────────────────────────────────
// Query-Params: ?days=30 (default 30, max 365)
advertisersRouter.get('/me/stats', requireAuth, async (req, res, next) => {
  try {
    const days = Math.min(parseInt(req.query.days ?? '30', 10) || 30, 365);

    // Advertiser-ID des eingeloggten Users
    const advResult = await pool.query(
      'SELECT id FROM advertisers WHERE user_id = $1',
      [req.user.id]
    );
    if (advResult.rows.length === 0) {
      return res.json({ impressions: 0, clicks: 0, ctr: 0, byDay: [] });
    }
    const advertiserId = advResult.rows[0].id;

    // ── Gesamt-Aggregat ───────────────────────────────────────────────────────
    const totals = await pool.query(
      `SELECT
         COUNT(*)                           AS impressions,
         COUNT(*) FILTER (WHERE i.clicked) AS clicks
       FROM impressions i
       JOIN ads a ON a.id = i.ad_id
       WHERE a.advertiser_id = $1
         AND i.created_at >= NOW() - ($2 || ' days')::INTERVAL`,
      [advertiserId, days]
    );

    const { impressions, clicks } = totals.rows[0];
    const imp = parseInt(impressions, 10);
    const clk = parseInt(clicks, 10);
    const ctr = imp > 0 ? parseFloat((clk / imp * 100).toFixed(2)) : 0;

    // ── Tages-Auflösung (für Chart) ───────────────────────────────────────────
    const byDay = await pool.query(
      `SELECT
         DATE(i.created_at)                 AS day,
         COUNT(*)                           AS impressions,
         COUNT(*) FILTER (WHERE i.clicked) AS clicks
       FROM impressions i
       JOIN ads a ON a.id = i.ad_id
       WHERE a.advertiser_id = $1
         AND i.created_at >= NOW() - ($2 || ' days')::INTERVAL
       GROUP BY DATE(i.created_at)
       ORDER BY day ASC`,
      [advertiserId, days]
    );

    // ── Top-Ads ───────────────────────────────────────────────────────────────
    const topAds = await pool.query(
      `SELECT
         a.id, a.title,
         COUNT(i.id)                           AS impressions,
         COUNT(i.id) FILTER (WHERE i.clicked)  AS clicks
       FROM ads a
       LEFT JOIN impressions i
         ON i.ad_id = a.id
         AND i.created_at >= NOW() - ($2 || ' days')::INTERVAL
       WHERE a.advertiser_id = $1
       GROUP BY a.id, a.title
       ORDER BY impressions DESC
       LIMIT 5`,
      [advertiserId, days]
    );

    res.json({
      period:     { days },
      impressions: imp,
      clicks:      clk,
      ctr,
      byDay: byDay.rows.map(r => ({
        day:         r.day,
        impressions: parseInt(r.impressions, 10),
        clicks:      parseInt(r.clicks, 10),
      })),
      topAds: topAds.rows.map(r => ({
        id:          r.id,
        title:       r.title,
        impressions: parseInt(r.impressions, 10),
        clicks:      parseInt(r.clicks, 10),
        ctr:         parseInt(r.impressions, 10) > 0
          ? parseFloat((parseInt(r.clicks, 10) / parseInt(r.impressions, 10) * 100).toFixed(2))
          : 0,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/advertisers/register ────────────────────────────────────────────
// Wird jetzt primär über /api/auth/register?role=advertiser abgewickelt.
// Dieser Endpoint bleibt für direkte API-Nutzung ohne Auth.
advertisersRouter.post('/register', async (req, res, next) => {
  try {
    const { companyName, email, postalCode, plan = 'basic' } = req.body;
    if (!companyName || !email || !postalCode) {
      return res.status(400).json({ error: 'companyName, email und postalCode erforderlich' });
    }
    const result = await pool.query(
      `INSERT INTO advertisers (company_name, contact_email, postal_code, plan)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [companyName, email, postalCode, plan]
    );
    res.status(201).json({ advertiserId: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});
