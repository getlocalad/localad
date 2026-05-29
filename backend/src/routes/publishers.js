import { Router } from 'express';
import { requireAuth, requirePublisherProfile } from '../middleware/auth.js';
import { pool } from '../db/db.js';
import {
  generateVerificationToken,
  verifyViaDns,
  verifyViaMetaTag,
  markPublisherVerified,
} from '../services/publisherVerification.js';

export const publishersRouter = Router();

// ── POST /api/publishers/register ────────────────────────────────────────────
// Wählt Verifikationsmethode, legt Publisher in DB an, gibt Token + Anleitung zurück
publishersRouter.post('/register', requireAuth, async (req, res, next) => {
  try {
    const { domain, verificationMethod } = req.body;

    if (!domain || !['dns', 'meta-tag'].includes(verificationMethod)) {
      return res.status(400).json({
        error: 'domain und verificationMethod ("dns" | "meta-tag") erforderlich',
      });
    }

    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    const token = generateVerificationToken();

    // Prüfen ob Domain bereits existiert
    const existing = await pool.query(
      'SELECT id, is_verified FROM publishers WHERE domain = $1',
      [cleanDomain]
    );

    if (existing.rows.length > 0 && existing.rows[0].is_verified) {
      return res.status(409).json({ error: 'Domain bereits verifiziert' });
    }

    // Upsert: neu anlegen oder Token aktualisieren
    const result = await pool.query(
      `INSERT INTO publishers (user_id, domain, verification_method, verification_token)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (domain) DO UPDATE
         SET verification_method = EXCLUDED.verification_method,
             verification_token  = EXCLUDED.verification_token,
             updated_at          = NOW()
       RETURNING id`,
      [req.user.id, cleanDomain, verificationMethod, token]
    );

    const publisherId = result.rows[0].id;

    const instructions =
      verificationMethod === 'dns'
        ? {
            type: 'dns',
            record: 'TXT',
            name: cleanDomain,
            value: `localad-verify=${token}`,
            hint: 'TXT-Record bei deinem DNS-Anbieter eintragen, dann /verify aufrufen',
          }
        : {
            type: 'meta-tag',
            tag: `<meta name="localad-verify" content="${token}" />`,
            hint: 'Tag im <head> der Startseite einfügen, dann /verify aufrufen',
          };

    res.json({ publisherId, token, instructions });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/publishers/verify ───────────────────────────────────────────────
// Prüft ob Token gesetzt wurde, markiert Publisher als verifiziert
publishersRouter.post('/verify', requireAuth, requirePublisherProfile, async (req, res, next) => {
  try {
    const { domain } = req.body;
    if (!domain) return res.status(400).json({ error: 'domain erforderlich' });

    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();

    const result = await pool.query(
      'SELECT id, verification_method, verification_token, is_verified FROM publishers WHERE domain = $1',
      [cleanDomain]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Domain nicht registriert' });
    }

    const publisher = result.rows[0];

    if (publisher.is_verified) {
      return res.json({ verified: true, message: 'Bereits verifiziert' });
    }

    const { verification_method, verification_token, id } = publisher;

    let verified = false;
    if (verification_method === 'dns') {
      verified = await verifyViaDns(cleanDomain, verification_token);
    } else {
      verified = await verifyViaMetaTag(cleanDomain, verification_token);
    }

    if (verified) {
      await markPublisherVerified(id);
      return res.json({ verified: true, message: 'Domain erfolgreich verifiziert' });
    }

    res.json({
      verified: false,
      message: verification_method === 'dns'
        ? 'TXT-Record nicht gefunden. DNS-Propagation kann bis zu 48h dauern.'
        : 'Meta-Tag nicht gefunden. Sicherstellen dass der Tag im <head> steht.',
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/publishers/me ────────────────────────────────────────────────────
publishersRouter.get('/me', requireAuth, requirePublisherProfile, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.domain, p.is_verified, p.verified_at, p.revenue_share_pct,
              COUNT(i.id) AS total_impressions
       FROM publishers p
       LEFT JOIN impressions i ON i.publisher_id = p.id
       WHERE p.user_id = $1
       GROUP BY p.id`,
      [req.user.id]
    );
    res.json({ publisher: result.rows[0] ?? null });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/publishers/me/stats ─────────────────────────────────────────────
// Query-Params: ?days=30 (default 30, max 365)
publishersRouter.get('/me/stats', requireAuth, requirePublisherProfile, async (req, res, next) => {
  try {
    const days = Math.min(parseInt(req.query.days ?? '30', 10) || 30, 365);

    const pubResult = await pool.query(
      'SELECT id, revenue_share_pct FROM publishers WHERE user_id = $1 AND is_verified = TRUE',
      [req.user.id]
    );
    if (pubResult.rows.length === 0) {
      return res.json({ impressions: 0, clicks: 0, ctr: 0, estimatedRevenue: 0, byDay: [], topSlots: [] });
    }
    const { id: publisherId, revenue_share_pct } = pubResult.rows[0];

    // ── Gesamt-Aggregat ───────────────────────────────────────────────────────
    const totals = await pool.query(
      `SELECT
         COUNT(*)                           AS impressions,
         COUNT(*) FILTER (WHERE clicked)   AS clicks
       FROM impressions
       WHERE publisher_id = $1
         AND created_at >= NOW() - ($2 || ' days')::INTERVAL`,
      [publisherId, days]
    );

    const imp = parseInt(totals.rows[0].impressions, 10);
    const clk = parseInt(totals.rows[0].clicks, 10);
    const ctr = imp > 0 ? parseFloat((clk / imp * 100).toFixed(2)) : 0;

    // Vereinfachte Umsatzschätzung: 0.50 € CPM * Umsatzbeteiligung
    const CPM_EUR = 0.50;
    const estimatedRevenue = parseFloat(((imp / 1000) * CPM_EUR * (revenue_share_pct / 100)).toFixed(2));

    // ── Tages-Auflösung ───────────────────────────────────────────────────────
    const byDay = await pool.query(
      `SELECT
         DATE(created_at)                   AS day,
         COUNT(*)                           AS impressions,
         COUNT(*) FILTER (WHERE clicked)   AS clicks
       FROM impressions
       WHERE publisher_id = $1
         AND created_at >= NOW() - ($2 || ' days')::INTERVAL
       GROUP BY DATE(created_at)
       ORDER BY day ASC`,
      [publisherId, days]
    );

    // ── Top-Slots ─────────────────────────────────────────────────────────────
    const topSlots = await pool.query(
      `SELECT
         slot_id,
         COUNT(*)                           AS impressions,
         COUNT(*) FILTER (WHERE clicked)   AS clicks
       FROM impressions
       WHERE publisher_id = $1
         AND created_at >= NOW() - ($2 || ' days')::INTERVAL
         AND slot_id IS NOT NULL
       GROUP BY slot_id
       ORDER BY impressions DESC
       LIMIT 10`,
      [publisherId, days]
    );

    res.json({
      period: { days },
      impressions: imp,
      clicks:      clk,
      ctr,
      estimatedRevenue,
      revenueSharePct: revenue_share_pct,
      byDay: byDay.rows.map(r => ({
        day:         r.day,
        impressions: parseInt(r.impressions, 10),
        clicks:      parseInt(r.clicks, 10),
      })),
      topSlots: topSlots.rows.map(r => ({
        slotId:      r.slot_id,
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
