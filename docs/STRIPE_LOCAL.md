# Stripe Webhooks lokal testen

## Voraussetzung: Stripe CLI installieren

**Windows (winget):**
```
winget install Stripe.StripeCLI
```

**macOS:**
```
brew install stripe/stripe-cli/stripe
```

**Linux:**
```
wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_linux_x86_64.tar.gz
tar -xvf stripe_linux_x86_64.tar.gz && mv stripe /usr/local/bin/
```

---

## Einmalig: Login

```bash
stripe login
# Browser öffnet sich → Stripe-Account verbinden
```

---

## Workflow

### Terminal 1 – Backend
```bash
cd backend && npm run dev
```

### Terminal 2 – Stripe CLI Listener
```bash
cd backend && npm run stripe:listen
# Ausgabe:
# > Ready! Your webhook signing secret is whsec_xxxx...
# Diesen Wert in .env eintragen: STRIPE_WEBHOOK_SECRET=whsec_xxxx...
```

### Terminal 3 – Events manuell auslösen (optional)
```bash
# Checkout abgeschlossen simulieren
npm run stripe:trigger:checkout

# Abo-Kündigung simulieren
npm run stripe:trigger:cancel
```

---

## Echter Checkout-Flow lokal testen

```bash
# 1. Checkout-Session erstellen (userId aus der DB nehmen)
curl -X POST http://localhost:3000/api/stripe/create-checkout \
  -H "Content-Type: application/json" \
  -d '{"userId":"<UUID>","email":"test@getlocalad.dev"}'

# 2. checkoutUrl im Browser öffnen
# 3. Stripe Testkarte: 4242 4242 4242 4242, Datum: beliebig, CVC: beliebig
# 4. Stripe CLI zeigt eingehenden Webhook → Backend verarbeitet → User.is_subscribed = TRUE prüfen
```

---

## Stripe Testkarten

| Karte | Verhalten |
|---|---|
| `4242 4242 4242 4242` | Zahlung erfolgreich |
| `4000 0000 0000 0002` | Karte abgelehnt |
| `4000 0025 0000 3155` | 3D Secure erforderlich |

Ablaufdatum: beliebiges Datum in der Zukunft. CVC: beliebige 3 Ziffern.

---

## `.env` für lokale Stripe-Tests

```env
STRIPE_SECRET_KEY=sk_test_...        # Aus Stripe Dashboard → Entwickler → API-Schlüssel
STRIPE_WEBHOOK_SECRET=whsec_...      # Aus stripe listen Ausgabe
STRIPE_PRICE_USER_MONTHLY=price_...  # Aus Stripe Dashboard → Produkte
```
