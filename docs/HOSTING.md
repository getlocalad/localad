# Hosting-Entscheidung

## Vergleich für MVP-Phase

| Kriterium | Railway | Render | Hetzner VPS |
|---|---|---|---|
| PostgreSQL inklusive | ✅ | ✅ (free tier) | ❌ (selbst installieren) |
| Deploy aus Git | ✅ automatisch | ✅ automatisch | ❌ manuell/CI |
| Kaltstart-Problem | ❌ keines | ⚠️ free tier schläft | ❌ keines |
| Preis MVP | ~10 €/Monat | 0 € (free, limitiert) | ab 4 €/Monat |
| Skalierung | einfach | einfach | manuell |
| Setup-Aufwand | sehr gering | gering | hoch |
| Empfehlung MVP | ✅ **Wahl** | Backup-Option | Ab 1.000+ Nutzern |

**Entscheidung: Railway für MVP**, Hetzner wenn monatliche Serverkosten durch Nutzer gedeckt sind (Break-even bei ~10–15 Abo-Nutzern).

---

## Railway Deployment (empfohlen)

### 1. Einmalig: Projekt anlegen

```bash
# Railway CLI installieren
npm install -g @railway/cli

# Login
railway login

# Projekt initialisieren (im LocalAd-Root-Ordner)
railway init

# PostgreSQL hinzufügen
railway add postgresql
```

### 2. Umgebungsvariablen setzen

```bash
# In Railway Dashboard: Settings → Variables
# Oder per CLI:
railway variables set JWT_SECRET="$(openssl rand -hex 32)"
railway variables set JWT_REFRESH_SECRET="$(openssl rand -hex 32)"
railway variables set STRIPE_SECRET_KEY="sk_live_..."
railway variables set STRIPE_WEBHOOK_SECRET="whsec_..."
railway variables set STRIPE_PRICE_USER_MONTHLY="price_..."
railway variables set STRIPE_PRICE_ADVERTISER_BASIC="price_..."
railway variables set STRIPE_PRICE_ADVERTISER_STANDARD="price_..."
railway variables set STRIPE_PRICE_ADVERTISER_PREMIUM="price_..."
railway variables set DASHBOARD_URL="https://getlocalad.de"
railway variables set NODE_ENV="production"
railway variables set ALLOWED_ORIGINS="https://getlocalad.de"

# DB-Variablen werden von Railway automatisch gesetzt:
# DATABASE_URL, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
```

### 3. Schema einspielen

```bash
# Nach erstem Deploy:
railway run psql $DATABASE_URL -f backend/src/db/schema.sql
```

### 4. Deployen

```bash
# Aus Git (empfohlen – automatisch bei Push):
git push origin main

# Manuell:
railway up
```

### 5. Domain verbinden

Railway Dashboard → Settings → Domains → Custom Domain → `api.getlocalad.de`
DNS: CNAME `api.getlocalad.de` → Railway-URL

---

## Stripe Webhook für Produktion

```bash
# Im Stripe Dashboard:
# Developers → Webhooks → Add endpoint
# URL: https://api.getlocalad.de/api/stripe/webhook
# Events: checkout.session.completed, invoice.paid, customer.subscription.deleted

# Webhook-Secret in Railway-Variablen eintragen
```

---

## Extension: API-URL für Produktion

In `extension/src/utils/config.js` ist `PRODUCTION_API = 'https://api.getlocalad.de'` bereits gesetzt.
Nutzer schalten per Popup-Badge zwischen Dev/Prod.

Für Store-Release: Default auf `production` setzen:

```js
// config.js
const DEFAULTS = {
  apiBase:     'https://api.getlocalad.de',  // ← ändern für Release
  environment: 'production',
};
```
