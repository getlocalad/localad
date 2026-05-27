-- ══════════════════════════════════════════════════════════════
-- LocalAd Demo-Seed
-- Einmalig auf Railway Postgres ausführen (Railway → Postgres → Query)
-- ══════════════════════════════════════════════════════════════

-- 1. User für LocalAd als Advertiser (kein Login nötig)
INSERT INTO users (email, password_hash)
VALUES ('werbung@getlocalad.de', '$2b$12$LOCALAD_INTERNAL_NEVER_LOGIN_xxxxxxxxxxxxxxxxxxxxxxxxxx')
ON CONFLICT (email) DO NOTHING;

-- 2. Advertiser-Eintrag
INSERT INTO advertisers (user_id, company_name, contact_email, postal_code, plan, is_active, subscription_end)
SELECT id, 'LocalAd', 'werbung@getlocalad.de', '47051', 'premium', TRUE, '2099-12-31'
FROM users WHERE email = 'werbung@getlocalad.de'
ON CONFLICT DO NOTHING;

-- 3. Promo-Anzeige
INSERT INTO ads (advertiser_id, title, image_url, target_url, alt_text, postal_codes, is_active)
SELECT
  adv.id,
  'Hier könnte Ihre Werbung stehen',
  'https://getlocalad.de/assets/promo-banner.svg',
  'https://getlocalad.de',
  'Lokale Werbung für Duisburg – jetzt als Werbetreibender registrieren',
  ARRAY[
    '47051','47053','47055','47057','47058','47059',
    '47119','47137','47138','47139',
    '47166','47167','47169',
    '47178','47179','47198','47199',
    '47226','47228','47229','47239',
    '47249','47259','47269','47279'
  ],
  TRUE
FROM advertisers adv
JOIN users u ON u.id = adv.user_id
WHERE u.email = 'werbung@getlocalad.de'
ON CONFLICT DO NOTHING;

-- 4. Publisher: getlocalad.de (manuell verifiziert, 0% Revenue-Share – eigene Seite)
INSERT INTO publishers (domain, contact_email, is_verified, verification_method, revenue_share_pct)
VALUES ('getlocalad.de', 'hallo@getlocalad.de', TRUE, 'manual', 0)
ON CONFLICT (domain) DO NOTHING;

-- Prüfen:
SELECT 'advertiser' AS typ, company_name AS name, is_active::text AS status FROM advertisers WHERE contact_email = 'werbung@getlocalad.de'
UNION ALL
SELECT 'ad', title, is_active::text FROM ads WHERE title = 'Hier könnte Ihre Werbung stehen'
UNION ALL
SELECT 'publisher', domain, is_verified::text FROM publishers WHERE domain = 'getlocalad.de';
