# LocalAd – Lokale Entwicklungsumgebung

## Voraussetzungen

- Node.js 20+
- Docker Desktop
- Chrome 109+

---

## 1. Datenbank starten

```bash
# Im Projekt-Root:
docker compose up -d

# Schema wird automatisch eingespielt (docker-entrypoint-initdb.d)
# DB läuft auf localhost:5432
# pgAdmin (optional): docker compose --profile tools up -d → http://localhost:5050
```

---

## 2. Backend starten

```bash
cd backend

# Einmalig: Abhängigkeiten installieren
npm install

# .env anlegen (aus .env.example kopieren)
cp .env.example .env
# Dann in .env mindestens setzen:
#   DB_PASSWORD=localad_dev
#   JWT_SECRET=<min. 32 zufällige Zeichen>
#   JWT_REFRESH_SECRET=<min. 32 zufällige Zeichen>

# Server starten
npm run dev
# → läuft auf http://localhost:3000
# → http://localhost:3000/health zeigt {"status":"ok"}
```

---

## 3. Testdaten anlegen (einmalig)

```bash
# User registrieren
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@getlocalad.dev","password":"Test1234!"}'

# Login → accessToken kopieren
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@getlocalad.dev","password":"Test1234!"}'

# Publisher registrieren (TOKEN aus Response verwenden)
curl -X POST http://localhost:3000/api/publishers/register \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"domain":"localhost","verificationMethod":"meta-tag"}'

# Publisher manuell in DB verifizieren (für lokale Tests)
# psql -U localad -d localad -c "UPDATE publishers SET is_verified=TRUE WHERE domain='localhost';"

# Werbetreibenden anlegen
curl -X POST http://localhost:3000/api/advertisers/register \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Muster GmbH","email":"werbung@muster.de","postalCode":"47051","plan":"basic"}'

# Werbetreibenden manuell aktivieren (ohne Stripe im Dev-Modus)
# psql -U localad -d localad -c "UPDATE advertisers SET is_active=TRUE WHERE contact_email='werbung@muster.de';"

# Ad anlegen
curl -X POST http://localhost:3000/api/ads \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Muster GmbH – Duisburg",
    "imageUrl": "https://via.placeholder.com/728x90?text=Lokale+Werbung",
    "targetUrl": "https://example.de",
    "altText": "Lokale Werbung Duisburg",
    "postalCodes": ["47051","47053","47055"]
  }'
```

---

## 4. Extension in Chrome laden

1. `chrome://extensions` öffnen
2. Entwicklermodus aktivieren (Toggle oben rechts)
3. „Entpackte Erweiterung laden" → Ordner `/extension` auswählen
4. LocalAd-Icon erscheint in der Toolbar

---

## 5. Testseite öffnen

Die Datei `test/testpage.html` im Browser öffnen (`Datei öffnen` oder lokaler Server).

Die Seite enthält einen `data-localad-slot`-Container.  
Extension muss aktiv sein und PLZ `47051` eingestellt haben.

**Ablauf End-to-End:**
1. Extension-Popup öffnen → PLZ `47051` eingeben → Speichern
2. `testpage.html` laden
3. Content Script erkennt Slot → fragt Backend → Backend liefert Ad
4. Slot wird durch lokale Ad ersetzt

> Hinweis: `localhost` muss als verifizierter Publisher in der DB stehen (siehe Schritt 3).

---

## Bekannte Dev-Einschränkungen

| Problem | Lösung |
|---|---|
| Extension kann `localhost` nicht per DNS verifizieren | Publisher manuell in DB auf `is_verified=TRUE` setzen |
| Stripe-Webhooks lokal nicht erreichbar | `stripe listen --forward-to localhost:3000/api/stripe/webhook` (Stripe CLI) |
| CORS-Fehler der Extension | `ALLOWED_ORIGINS=*` in `.env` für lokale Dev |
