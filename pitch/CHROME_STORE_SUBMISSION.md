# Chrome Web Store – Submission-Vorbereitung

## Store-Listing

### Name
```
LocalAd – Lokale Werbung, kein Konzerntracking
```

### Kurzbeschreibung (132 Zeichen max)
```
Blockiert Google, Meta & Co. Zeigt stattdessen echte lokale Werbung aus deiner Region. Für Duisburg.
```

### Ausführliche Beschreibung
```
LocalAd ist der erste Werbeblocker, der Konzernwerbung nicht einfach entfernt –
sondern durch lokale Alternativen ersetzt.

WAS LOCALAD MACHT:
• Blockiert Werbung von Google, Meta, Amazon, Taboola und anderen Konzernen
• Zeigt auf Partnerseiten lokale Anzeigen aus deiner Postleitzahl
• Unterstützt damit direkt kleine Unternehmen in deiner Region

WIE ES FUNKTIONIERT:
1. Extension installieren
2. Postleitzahl eingeben (z.B. 47051 für Duisburg-Mitte)
3. Für 3 €/Monat abonnieren
4. Fertig – Konzernwerbung weg, lokale Wirtschaft gestärkt

FÜR WERBETREIBENDE:
Lokale Unternehmen können für 50–200 €/Monat Anzeigen schalten,
die nur Nutzern in bestimmten PLZ-Gebieten gezeigt werden.

FÜR WEBSITE-BETREIBER (PUBLISHER):
Registrierte Publisher erhalten eine Umsatzbeteiligung,
wenn lokale Ads ihre Werbeplätze füllen.

DATENSCHUTZ:
• Deine PLZ bleibt auf deinem Gerät
• Kein Tracking, keine Weitergabe an Dritte
• Kein MITM, keine TLS-Interception
• Replacement nur auf Seiten, die explizit zugestimmt haben

PILOTMARKT: Duisburg
Weitere Städte folgen nach erfolgreichem MVP.
```

### Kategorie
`Productivity` → Subcategory: `Tools`

### Sprache
Primär: Deutsch (de)

---

## Technische Anforderungen

### Icons (PNG, keine abgerundeten Ecken – Chrome rundet selbst)
| Größe | Datei | Verwendung |
|---|---|---|
| 16×16 | `assets/icons/icon16.png` | Favicon, Toolbar klein |
| 48×48 | `assets/icons/icon48.png` | Extensions-Seite |
| 128×128 | `assets/icons/icon128.png` | Store-Listing |

### Screenshots (1280×800 oder 640×400, PNG/JPEG)
Mindestens 1, maximal 5. Empfohlen:

1. **Vorher/Nachher** – Seite mit Konzernwerbung vs. lokale Ad
2. **Popup** – PLZ-Eingabe, Abo-Status
3. **Onboarding** – Willkommens-Screen
4. **Werbetreibenden-Dashboard** – Ad anlegen
5. **Statistik** – Impressions/Klicks-Übersicht

### Promotional Images (optional, erhöht Sichtbarkeit)
- Small: 440×280 px
- Large: 920×680 px
- Marquee: 1400×560 px

---

## Privacy Policy (Pflicht)

URL: `https://getlocalad.de/datenschutz`

Pflichtinhalt (Kurzfassung):
```
LocalAd erhebt folgende Daten:
- E-Mail-Adresse (für Account und Abo)
- Postleitzahl (lokal auf dem Gerät, nicht an Server übertragen)
- Impressions und Klicks (anonymisiert, ohne Nutzer-ID sofern nicht angemeldet)

Keine Weitergabe an Dritte außer:
- Stripe (Zahlungsabwicklung)
- Railway/Hosting-Provider (Infrastruktur)

Löschung: Auf Anfrage, jederzeit per E-Mail an datenschutz@getlocalad.de
```

---

## Submission-Checklist

### Vor dem Upload
- [ ] `npm run build:rules` ausgeführt (aktuelle block_rules.json)
- [ ] `manifest.json` Version erhöht (z.B. `"version": "1.0.0"`)
- [ ] `API_BASE` in `config.js` auf Production-URL gesetzt
- [ ] Icons alle 3 Größen vorhanden (16, 48, 128 px)
- [ ] Extension lokal getestet (Chrome Dev Mode)
- [ ] Kein `console.log` mit sensiblen Daten
- [ ] `.env` nicht im ZIP enthalten (durch .gitignore gesichert)

### ZIP erstellen
```bash
cd extension
npm run zip
# → dist/localad-extension.zip
```

### Upload
1. https://chrome.google.com/webstore/devconsole
2. „Neues Element" → ZIP hochladen
3. Store-Listing ausfüllen (Texte oben)
4. Screenshots hochladen
5. Privacy Policy URL eintragen
6. „Zur Überprüfung einreichen"

### Review-Dauer
- Erstmalig: 1–7 Werktage
- Updates: 1–3 Werktage
- Bei Ablehnung: Begründung per E-Mail, anpassen, erneut einreichen

### Developer Account
- Einmalige Gebühr: 5 USD
- Konto: https://chrome.google.com/webstore/devconsole

---

## Firefox Add-ons (addons.mozilla.org)

Manifest V3 wird ab Firefox 109 unterstützt. Das `browser_specific_settings.gecko`
ist bereits in `manifest.json` eingetragen (`localad@getlocalad.de`).

```bash
# Firefox-Submission:
# https://addons.mozilla.org/developers/
# Gleiche ZIP-Datei verwenden
# Zusätzlich: Quellcode-Upload erforderlich wenn minifiziert
```
