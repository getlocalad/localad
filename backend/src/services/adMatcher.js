import { pool } from '../db/db.js';

// ── Hauptfunktion: passende Ad finden ────────────────────────────────────────
// Ablauf:
// 1. Prüfen ob Publisher registriert + verifiziert
// 2. Aktive Ads suchen, die die PLZ des Nutzers abdecken
// 3. Eine Ad zufällig auswählen (gleichgewichtet, erweiterbar auf weighted)
// 4. Impression in DB schreiben
// 5. Ad-Daten zurückgeben
export async function matchAd({ publisherDomain, slotId, postalCode, userId = null }) {
  // 1. Publisher-Check
  const publisherResult = await pool.query(
    `SELECT id FROM publishers
     WHERE domain = $1 AND is_verified = TRUE`,
    [publisherDomain]
  );

  if (publisherResult.rows.length === 0) {
    // Publisher nicht verifiziert → kein Replacement (Extension blockiert nur)
    return null;
  }

  const publisherId = publisherResult.rows[0].id;

  // 2. Passende Ads laden
  // Bedingungen: aktiv, Laufzeit gültig, PLZ des Nutzers in postal_codes des Ads
  const adsResult = await pool.query(
    `SELECT a.id, a.title, a.image_url, a.target_url, a.alt_text,
            adv.company_name AS advertiser_name
     FROM ads a
     JOIN advertisers adv ON adv.id = a.advertiser_id
     WHERE a.is_active = TRUE
       AND adv.is_active = TRUE
       AND ($1 = ANY(a.postal_codes))
       AND (a.starts_at IS NULL OR a.starts_at <= NOW())
       AND (a.ends_at   IS NULL OR a.ends_at   >= NOW())
     ORDER BY RANDOM()
     LIMIT 5`,
    [postalCode]
  );

  if (adsResult.rows.length === 0) {
    return null; // Kein passender Werbetreibender für diese PLZ
  }

  // 3. Erste Ad nehmen (bereits per RANDOM() sortiert)
  const ad = adsResult.rows[0];

  // 4. Impression tracken (fire-and-forget, blockiert nicht die Response)
  trackImpression({ adId: ad.id, publisherId, slotId, postalCode, userId }).catch(err => {
    console.warn('[AdMatcher] Impression-Tracking fehlgeschlagen:', err.message);
  });

  // 5. Zurückgeben
  return {
    adId:           ad.id,
    imageUrl:       ad.image_url,
    targetUrl:      ad.target_url,
    altText:        ad.alt_text || ad.title,
    advertiserName: ad.advertiser_name,
  };
}

// ── Impression in DB schreiben ────────────────────────────────────────────────
async function trackImpression({ adId, publisherId, slotId, postalCode, userId }) {
  await pool.query(
    `INSERT INTO impressions (ad_id, publisher_id, slot_id, postal_code, user_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [adId, publisherId, slotId, postalCode, userId]
  );
}

// ── Klick tracken ─────────────────────────────────────────────────────────────
export async function trackClick(impressionId) {
  await pool.query(
    `UPDATE impressions
     SET clicked = TRUE, clicked_at = NOW()
     WHERE id = $1`,
    [impressionId]
  );
}
