import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../db/db.js';
import { matchAd, trackClick } from '../services/adMatcher.js';

export const adsRouter = Router();

// ── POST /api/ads/match ───────────────────────────────────────────────────────
// Extension ruft diesen Endpoint auf: PLZ + Publisher-Domain + Slot → lokale Ad
adsRouter.post('/match', async (req, res, next) => {
  try {
    const { publisherDomain, slotId, postalCode, userId } = req.body;

    if (!publisherDomain || !postalCode) {
      return res.status(400).json({ error: 'publisherDomain und postalCode erforderlich' });
    }

    if (!/^\d{5}$/.test(postalCode)) {
      return res.status(400).json({ error: 'postalCode muss 5-stellig sein' });
    }

    const ad = await matchAd({ publisherDomain, slotId, postalCode, userId });

    if (!ad) {
      return res.status(204).end(); // Kein Content → Extension tut nichts (nur blockieren)
    }

    res.json(ad);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/ads/click ───────────────────────────────────────────────────────
// Klick-Tracking (wird vom Content Script gefeuert)
adsRouter.post('/click', async (req, res, next) => {
  try {
    const { impressionId } = req.body;
    if (!impressionId) return res.status(400).json({ error: 'impressionId erforderlich' });
    await trackClick(impressionId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/ads ──────────────────────────────────────────────────────────────
// Dashboard: alle Ads des eingeloggten Werbetreibenden
adsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT a.id, a.title, a.image_url, a.target_url, a.postal_codes,
              a.is_active, a.starts_at, a.ends_at, a.created_at,
              COUNT(i.id)                          AS impressions,
              COUNT(i.id) FILTER (WHERE i.clicked) AS clicks
       FROM ads a
       JOIN advertisers adv ON adv.id = a.advertiser_id
       LEFT JOIN impressions i ON i.ad_id = a.id
       WHERE adv.user_id = $1
       GROUP BY a.id
       ORDER BY a.created_at DESC`,
      [req.user.id]
    );
    res.json({ ads: result.rows });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/ads ─────────────────────────────────────────────────────────────
// Werbetreibender erstellt neue Ad
adsRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const { title, imageUrl, targetUrl, altText, postalCodes, startsAt, endsAt } = req.body;

    if (!title || !imageUrl || !targetUrl || !Array.isArray(postalCodes) || postalCodes.length === 0) {
      return res.status(400).json({ error: 'title, imageUrl, targetUrl und postalCodes erforderlich' });
    }

    // Advertiser-ID des eingeloggten Users holen
    const advResult = await pool.query(
      'SELECT id, is_active FROM advertisers WHERE user_id = $1',
      [req.user.id]
    );

    if (advResult.rows.length === 0) {
      return res.status(403).json({ error: 'Kein Werbetreibenden-Account gefunden' });
    }
    if (!advResult.rows[0].is_active && process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ error: 'Abo nicht aktiv' });
    }

    const advertiserId = advResult.rows[0].id;

    const result = await pool.query(
      `INSERT INTO ads (advertiser_id, title, image_url, target_url, alt_text, postal_codes, starts_at, ends_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [advertiserId, title, imageUrl, targetUrl, altText, postalCodes, startsAt ?? null, endsAt ?? null]
    );

    res.status(201).json({ adId: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/ads/:id ───────────────────────────────────────────────────────
adsRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `DELETE FROM ads
       WHERE id = $1
         AND advertiser_id IN (SELECT id FROM advertisers WHERE user_id = $2)
       RETURNING id`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ad nicht gefunden oder keine Berechtigung' });
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
