# Railway Deployment – Schritt-für-Schritt

## Voraussetzungen

- [ ] Node.js ≥ 20 lokal installiert
- [ ] Git-Repository auf GitHub/GitLab gepusht
- [ ] Stripe-Produkte angelegt (siehe `STRIPE_SETUP.md`)
- [ ] Domain `getlocalad.de` registriert (z.B. bei IONOS, Namecheap, Hetzner DNS)

---

## Schritt 1: Railway CLI + Login

```bash
npm install -g @railway/cli
railway login
# Browser öffnet sich → mit GitHub-Account einloggen
```

---

## Schritt 2: Projekt anlegen

```bash
# Im LocalAd-Root-Ordner:
cd /pfad/zu/LocalAd

railway init
# → Projekt-Name: localad
# → Kein Template (blank)
```

---

## Schritt 3: PostgreSQL-Datenbank hinzufügen

```bash
railway add postgresql
# Railway legt automatisch eine PostgreSQL-Instanz an
# Env-Variablen DATABASE_URL, DB_HOST, DB_PORT etc. werden automatisch gesetzt
```

---

## Schritt 4: Umgebungsvariablen setzen

```bash
# Secrets (im Terminal):
railway variables set JWT_SECRET="$(openssl rand -hex 32)"
railway variables set JWT_REFRESH_SECRET="$(openssl rand -hex 32)"
railway variables set NODE_ENV="production"
railway variables set ALLOWED_ORIGINS="https://getlocalad.de"
railway variables set DASHBOARD_URL="https://getlocalad.de"

# Stripe (aus STRIPE_SETUP.md):
railway variables set STRIPE_SECRET_KEY="sk_live_..."
railway variables set STRIPE_WEBHOOK_SECRET="whsec_..."   # Nach Schritt 7 befüllen
railway variables set STRIPE_PRICE_USER_MONTHLY="price_..."
railway variables set STRIPE_PRICE_ADVERTISER_BASIC="price_..."
railway variables set STRIPE_PRICE_ADVERTISER_STANDARD="price_..."
railway variables set STRIPE_PRICE_ADVERTISER_PREMIUM="price_..."

# Optional (für spätere Features):
railway variables set GOOGLE_PLACES_API_KEY="..."
railway variables set SERPAPI_KEY="..."
```

---

## Schritt 5: Ersten Deploy ausführen

```bash
# Option A: Aus Git (empfohlen – danach automatisch bei jedem Push)
# Erst Repository mit Railway verbinden:
railway link   # → GitHub-Repo auswählen

# Option B: Manuell
railway up
```

Railway nutzt die `railway.toml` und das `backend/Dockerfile` automatisch.

---

## Schritt 6: Datenbankschema einspielen

```bash
# Einmalig nach erstem Deploy:
railway run psql $DATABASE_URL -f backend/src/db/schema.sql

# Alternativ lokal mit der Railway-DB verbinden:
railway connect postgresql
# → psql-Shell öffnet sich
# \i backend/src/db/schema.sql
```

---

## Schritt 7: Custom Domain für API

```
Railway Dashboard → Dein Projekt → localad-api → Settings → Domains
→ Custom Domain → api.getlocalad.de eingeben
→ Railway zeigt dir den CNAME-Wert an (z.B. api.getlocalad.de.up.railway.app)
```

**DNS-Eintrag beim Domain-Registrar:**
```
Typ:   CNAME
Name:  api
Ziel:  api.getlocalad.de.up.railway.app
TTL:   300
```

---

## Schritt 8: Custom Domain für Landing Page / Dashboard

Die Landing Page und Dashboards werden vom Express-Backend unter `getlocalad.de` ausgeliefert.
Entweder: Gleicher Railway-Service mit Apex-Domain, oder separates Hosting (Cloudflare Pages, Netlify).

**Option A – Railway Apex Domain:**
```
Railway → localad-api → Settings → Domains → getlocalad.de hinzufügen
DNS: A-Record → Railway-IP (wird im Dashboard angezeigt)
```

**Option B – Cloudflare Pages (empfohlen für statische Seiten):**
```bash
# dashboard/-Ordner als statische Site deployen
# In Cloudflare Pages: Verbindung zu Git-Repo, Build-Ordner: dashboard/
# DNS: getlocalad.de → Cloudflare Pages URL
# api.getlocalad.de → Railway (CNAME wie oben)
```

---

## Schritt 9: Stripe Production-Webhook eintragen

```
Stripe Dashboard → Entwickler → Webhooks → Endpunkt hinzufügen
URL: https://api.getlocalad.de/api/stripe/webhook
Events: checkout.session.completed, invoice.paid, customer.subscription.deleted

→ Webhook Signing Secret kopieren
railway variables set STRIPE_WEBHOOK_SECRET="whsec_live_..."
```

---

## Schritt 10: Extension für Production konfigurieren

In `extension/src/utils/config.js` den Default auf Production setzen:

```js
const DEFAULTS = {
  apiBase:     'https://api.getlocalad.de',  // ← Production
  environment: 'production',
};
```

Dann:
```bash
cd extension
npm run build:rules   # Aktuelle block_rules.json generieren
npm run zip           # → dist/localad-extension.zip
```

---

## Deployment-Checkliste vor Store-Submission

- [ ] `railway run curl https://api.getlocalad.de/health` → `{"status":"ok"}`
- [ ] Datenbankschema eingespielt (alle Tabellen vorhanden)
- [ ] Stripe Webhook live und empfängt Events
- [ ] `getlocalad.de` erreichbar, Landing Page lädt
- [ ] `https://getlocalad.de/impressum` erreichbar
- [ ] `https://getlocalad.de/datenschutz` erreichbar
- [ ] `https://getlocalad.de/agb` erreichbar
- [ ] Extension mit Production-API getestet (PLZ eingeben, Abo-Flow)
- [ ] Kein `console.log` mit sensiblen Daten in Extension-Code
- [ ] `.env` nicht in Git (`git status` prüfen)

---

## Monitoring (Railway)

```bash
# Logs in Echtzeit
railway logs

# Aktuelle Umgebungsvariablen
railway variables

# Service-Status
railway status
```

---

## Break-even Kalkulation

| Nutzer | Einnahmen/Monat | Railway-Kosten | Profit |
|---|---|---|---|
| 10 | 30 € | ~10 € | 20 € |
| 50 | 150 € | ~10 € | 140 € |
| 100 | 300 € | ~15 € | 285 € |

Ab ~4–5 zahlenden Nutzern ist Railway kostendeckend.
Migration zu Hetzner VPS (4 €/Monat) lohnt sich ab ~1.000 Nutzern.

