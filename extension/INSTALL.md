# LocalAd Extension – Lokal in Chrome laden

## Voraussetzungen
- Chrome oder Chromium (Version 109+)
- Keine Installation nötig – Extension wird direkt aus dem Ordner geladen

## Schritte

1. Chrome öffnen, in die Adresszeile eingeben:
   ```
   chrome://extensions
   ```

2. Oben rechts **„Entwicklermodus"** aktivieren (Toggle)

3. Auf **„Entpackte Erweiterung laden"** klicken

4. Den Ordner `/extension` aus diesem Projekt auswählen
   (der Ordner der die `manifest.json` enthält)

5. LocalAd erscheint in der Liste – fertig

## Nach Code-Änderungen

Auf der `chrome://extensions` Seite beim LocalAd-Eintrag auf den **Reload-Button** (↺) klicken.

## Firefox

1. In die Adresszeile eingeben: `about:debugging#/runtime/this-firefox`
2. **„Temporäres Add-on laden"** → `manifest.json` auswählen

## Für den Chrome Web Store (Release)

```bash
cd extension
npm install
npm run zip
```

→ Erstellt `dist/localad-extension.zip` zum Hochladen im Developer Dashboard.

## Testseite

Um das Ad-Replacement zu testen, eine HTML-Seite mit folgendem Slot erstellen:

```html
<div data-localad-slot="header-banner" style="width:728px;height:90px;background:#eee;">
  <!-- Hier erscheint die lokale Ad -->
</div>
```

Domain muss im Backend als verifizierter Publisher registriert sein.
