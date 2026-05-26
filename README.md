# LocalAd

> Browser Extension die Konzernwerbung blockiert und durch lokale Werbung aus der Region des Nutzers ersetzt.

---

## Produktidee

LocalAd verbindet drei Marktseiten:

| Nutzergruppe | Wert | Modell |
|---|---|---|
| **Endnutzer** | Werbefreies Surfen + regional relevante Werbung | 3 €/Monat Abo |
| **Lokale Werbetreibende** | Zielgenaue Platzierung im Duisburger Raum | 50–200 €/Monat Flatrate |
| **Publisher** | Umsatzbeteiligung statt Konzernwerbung | Opt-in per Domain-Verifizierung |

**Pilotmarkt:** Duisburg  
**Langfristiges Ziel:** Höhle der Löwen Pitch

---

## Technisches Grundprinzip

```
Seitenaufruf
    │
    ├─ Publisher nicht registriert → Blockieren (wie uBlock)
    │
    └─ Publisher registriert → Ad-Slot-Replacement
           │
           └─ Nutzer-PLZ → lokale Ads aus Backend
                  │
                  ├─ Google Places API (Standortdaten)
                  └─ Werbetreibenden-Datenbank (eigene)
```

**Wichtige Einschränkungen:**
- Kein MITM, keine TLS-Interception
- Replacement nur mit expliziter Publisher-Zustimmung (DNS- oder Meta-Tag-Verifizierung)
- Nutzer stimmt beim Install aktiv AGB zu
- Modell rechtlich analog: Brave Browser Creator Program

---

## Tech Stack

| Bereich | Technologie |
|---|---|
| Extension | Manifest V3, TypeScript |
| Backend | Node.js + Express |
| Datenbank | PostgreSQL |
| Externe APIs | Google Places API, SerpAPI (Google Events) |
| Zahlungen | Stripe |
| Hosting | TBD |

---

## Projektstruktur

```
/extension
  /src
    /content        # Content Scripts (Ad-Erkennung, DOM-Manipulation)
    /background     # Service Worker (Regelwerk, API-Kommunikation)
    /popup          # Extension-UI (PLZ-Einstellung, Status)
    /utils          # Shared Helpers
  /assets           # Icons, Bilder
  manifest.json

/backend
  /src
    /routes         # API-Endpunkte
    /middleware     # Auth, Rate Limiting, Logging
    /services       # Business Logic (Ad-Matching, Publisher-Check)
    /db             # Datenbankschemas, Migrations
    /config         # Umgebungsvariablen, Konstanten

/dashboard
  /src
    /components     # Wiederverwendbare UI-Komponenten
    /pages          # Werbetreibende-Dashboard, Publisher-Dashboard
  /public

/docs
  /api              # API-Dokumentation
  /legal            # AGB, Datenschutz, Publisher-Vertrag
  /architecture     # Systemdiagramme, Entscheidungen (ADRs)

/pitch
  /assets           # Logos, Grafiken, Mockups
  /decks            # Präsentationen (HdL, Investoren)
```

---

## MVP-Scope (Phase 1)

Ziel: Funktionierende Extension für Duisburg als Proof of Concept.

- [ ] Extension erkennt und blockiert Konzernwerbung (uBlock-Basis)
- [ ] Nutzer gibt PLZ ein, Region wird gespeichert
- [ ] Backend liefert lokale Ads per PLZ
- [ ] Ein registrierter Publisher kann Ads austauschen
- [ ] Werbetreibender kann Anzeige über einfaches Dashboard buchen
- [ ] Stripe-Zahlung für Endnutzer-Abo

---

## Setup (folgt)

```bash
# Extension
cd extension && npm install && npm run dev

# Backend
cd backend && npm install && npm run dev

# Dashboard
cd dashboard && npm install && npm run dev
```

Umgebungsvariablen: siehe `/backend/.env.example` (folgt)

---

## Status

**Phase 1 – MVP-Entwicklung**  
Kein produktiver Code. Kein Nutzer. Kein Werbetreibender.  
Letztes Update: 2026-05-25
