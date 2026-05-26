-- LocalAd – PostgreSQL Schema
-- Version: 0.1.0
-- Ausführen: psql -d localad -f schema.sql

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS
-- Endnutzer mit Abo (3 €/Monat via Stripe)
-- ============================================================
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  postal_code       VARCHAR(5),                         -- Vom Nutzer eingestellt
  stripe_customer_id TEXT UNIQUE,
  is_subscribed     BOOLEAN NOT NULL DEFAULT FALSE,
  subscription_end  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_postal_code ON users(postal_code);

-- ============================================================
-- PUBLISHERS
-- Website-Betreiber die Opt-in geben (Domain-Verifizierung)
-- ============================================================
CREATE TABLE publishers (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  domain              TEXT NOT NULL UNIQUE,             -- z.B. "meine-zeitung.de"
  verification_method VARCHAR(10) CHECK (verification_method IN ('dns', 'meta-tag')),
  verification_token  TEXT NOT NULL,
  is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at         TIMESTAMPTZ,
  revenue_share_pct   NUMERIC(5,2) NOT NULL DEFAULT 30, -- Prozent (z.B. 30.00)
  stripe_account_id   TEXT UNIQUE,                      -- Stripe Connect
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_publishers_domain ON publishers(domain);
CREATE INDEX idx_publishers_verified ON publishers(is_verified);

-- ============================================================
-- ADVERTISERS
-- Lokale Werbetreibende (Flatrate 50–200 €/Monat)
-- ============================================================
CREATE TABLE advertisers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  company_name      TEXT NOT NULL,
  contact_email     TEXT NOT NULL,
  postal_code       VARCHAR(5) NOT NULL,               -- Standort des Werbetreibenden
  stripe_customer_id TEXT UNIQUE,
  plan              VARCHAR(20) CHECK (plan IN ('basic', 'standard', 'premium')),
  is_active         BOOLEAN NOT NULL DEFAULT FALSE,
  subscription_end  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_advertisers_postal_code ON advertisers(postal_code);
CREATE INDEX idx_advertisers_active ON advertisers(is_active);

-- ============================================================
-- ADS
-- Einzelne Werbemittel eines Werbetreibenden
-- ============================================================
CREATE TABLE ads (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  advertiser_id   UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  image_url       TEXT NOT NULL,
  target_url      TEXT NOT NULL,
  alt_text        TEXT,
  -- Targeting
  postal_codes    VARCHAR(5)[] NOT NULL DEFAULT '{}',  -- Ziel-PLZs
  -- Status
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ads_advertiser ON ads(advertiser_id);
CREATE INDEX idx_ads_active ON ads(is_active);
CREATE INDEX idx_ads_postal_codes ON ads USING GIN(postal_codes);

-- ============================================================
-- AD_SLOTS
-- Verfügbare Werbeplätze auf Publisher-Seiten
-- ============================================================
CREATE TABLE ad_slots (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  publisher_id  UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
  slot_id       TEXT NOT NULL,                         -- data-localad-slot Wert im HTML
  description   TEXT,                                  -- "Header Banner 728x90"
  width         INTEGER,
  height        INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(publisher_id, slot_id)
);

-- ============================================================
-- IMPRESSIONS
-- Jede Ad-Auslieferung (für Abrechnung und Stats)
-- ============================================================
CREATE TABLE impressions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ad_id         UUID NOT NULL REFERENCES ads(id),
  publisher_id  UUID REFERENCES publishers(id),
  slot_id       TEXT,
  postal_code   VARCHAR(5),
  user_id       UUID REFERENCES users(id),             -- nullable für Privacy
  clicked       BOOLEAN NOT NULL DEFAULT FALSE,
  clicked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_impressions_ad ON impressions(ad_id);
CREATE INDEX idx_impressions_publisher ON impressions(publisher_id);
CREATE INDEX idx_impressions_date ON impressions(created_at);

-- ============================================================
-- AUTO-UPDATE updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_publishers
  BEFORE UPDATE ON publishers FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_advertisers
  BEFORE UPDATE ON advertisers FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_ads
  BEFORE UPDATE ON ads FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
