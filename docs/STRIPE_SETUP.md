# Stripe-Produkte einrichten

## Übersicht der Produkte

| Produkt | Preis | Env-Variable | Beschreibung |
|---|---|---|---|
| LocalAd Pro (Nutzer) | 3,00 €/Monat | `STRIPE_PRICE_USER_MONTHLY` | Endnutzer-Abo |
| Advertiser Basis | 50,00 €/Monat | `STRIPE_PRICE_ADVERTISER_BASIC` | 1 Anzeige, 1–3 PLZ |
| Advertiser Standard | 100,00 €/Monat | `STRIPE_PRICE_ADVERTISER_STANDARD` | 3 Anzeigen, bis 10 PLZ |
| Advertiser Premium | 200,00 €/Monat | `STRIPE_PRICE_ADVERTISER_PREMIUM` | Unbegrenzt, Priority |

---

## Schritt 1: Stripe-Account vorbereiten

```bash
# Dashboard: https://dashboard.stripe.com
# Wichtig: Zuerst im TEST-Modus arbeiten (toggle oben links)
# Live-Modus erst für Production-Launch aktivieren
```

---

## Schritt 2: Produkte anlegen (Dashboard)

### 2a. LocalAd Pro – Endnutzer

1. Stripe Dashboard → **Produkte** → „Produkt erstellen"
2. Name: `LocalAd Pro`
3. Beschreibung: `Monatliches Abo für Endnutzer – Konzernwerbung blockieren, lokale Ads empfangen`
4. Preis hinzufügen:
   - Preismodell: **Standard**
   - Betrag: `3,00`
   - Währung: `EUR`
   - Abrechnung: **Monatlich**
5. Speichern → **Price-ID kopieren** (`price_...`)

### 2b. Advertiser Basis

1. Neues Produkt: `LocalAd Advertiser – Basis`
2. Preis: `50,00 EUR / Monat`
3. Price-ID notieren

### 2c. Advertiser Standard

1. Neues Produkt: `LocalAd Advertiser – Standard`
2. Preis: `100,00 EUR / Monat`
3. Price-ID notieren

### 2d. Advertiser Premium

1. Neues Produkt: `LocalAd Advertiser – Premium`
2. Preis: `200,00 EUR / Monat`
3. Price-ID notieren

---

## Schritt 3: Stripe Connect (für Publisher-Auszahlungen)

```
Stripe Dashboard → Connect → Einstellungen aktivieren
Typ: Express (empfohlen für kleine Publisher)
Land: Deutschland
```

---

## Schritt 4: Stripe CLI lokal (Webhook-Tests)

```bash
# Stripe CLI installieren (falls nicht vorhanden)
# macOS: brew install stripe/stripe-cli/stripe
# Windows: https://github.com/stripe/stripe-cli/releases

# Login
stripe login

# Webhook-Listener starten (eigenes Terminal-Fenster)
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Gibt aus: whsec_... → das ist dein lokales STRIPE_WEBHOOK_SECRET
```

---

## Schritt 5: .env befüllen

```bash
# backend/.env (lokal, nie committen!)
STRIPE_SECRET_KEY=sk_test_...          # Stripe Dashboard → API-Schlüssel → Geheimschlüssel
STRIPE_WEBHOOK_SECRET=whsec_...        # Ausgabe von stripe listen

STRIPE_PRICE_USER_MONTHLY=price_...    # Aus Schritt 2a
STRIPE_PRICE_ADVERTISER_BASIC=price_... # Aus Schritt 2b
STRIPE_PRICE_ADVERTISER_STANDARD=price_... # Aus Schritt 2c
STRIPE_PRICE_ADVERTISER_PREMIUM=price_... # Aus Schritt 2d
```

---

## Schritt 6: Checkout testen

```bash
# In backend-Verzeichnis (npm run dev läuft):

# Nutzer-Checkout auslösen
curl -X POST http://localhost:3000/api/stripe/create-checkout \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"plz": "47051"}'

# → gibt checkout_url zurück, im Browser öffnen
# Testkarte: 4242 4242 4242 4242 | Exp: beliebig in Zukunft | CVC: beliebig

# Webhook-Event simulieren
stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger customer.subscription.deleted
```

---

## Schritt 7: Production-Webhook (Railway)

```
Stripe Dashboard → Entwickler → Webhooks → Endpunkt hinzufügen
URL: https://api.getlocalad.de/api/stripe/webhook
Events auswählen:
  ✅ checkout.session.completed
  ✅ invoice.paid
  ✅ customer.subscription.deleted
  ✅ customer.subscription.paused

→ Signing Secret kopieren → in Railway-Env als STRIPE_WEBHOOK_SECRET setzen
```

---

## Testkarten (Stripe Test-Modus)

| Karte | Verhalten |
|---|---|
| 4242 4242 4242 4242 | Zahlung erfolgreich |
| 4000 0000 0000 0002 | Karte abgelehnt |
| 4000 0025 0000 3155 | 3D Secure required |
| 4000 0000 0000 9995 | Insufficient funds |

