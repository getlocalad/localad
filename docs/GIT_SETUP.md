# Git-Repository initialisieren

Diese Befehle im Ordner `LocalAd/` auf deinem Rechner ausführen (PowerShell oder Terminal).

## Einmalig

```bash
cd LocalAd

# Falls .git-Ordner von einem fehlgeschlagenen Versuch vorhanden ist:
# Windows: rd /s /q .git
# macOS/Linux: rm -rf .git

git init -b main
git config user.name "Nico"
git config user.email "nico@getlocalad.de"
```

## Ersten Commit erstellen

```bash
# Alle Dateien stagen (node_modules und .env werden durch .gitignore ausgeschlossen)
git add .

# Status prüfen – sollten ~35 Dateien sein, keine .env oder node_modules
git status

# Initialer Commit
git commit -m "feat: MVP-Grundstruktur

- Extension: Manifest V3, Content Script, Service Worker, Popup
- Backend: Express, Auth (JWT+bcrypt), Ad-Matching, Publisher-Verifizierung
- DB: PostgreSQL-Schema (users, publishers, advertisers, ads, impressions)
- Dashboard: Werbetreibende + Publisher HTML-UI
- Stripe: Webhook-Handler, Checkout-Endpoints
- Docker: PostgreSQL + pgAdmin compose
- Docs: DEV_SETUP, STRIPE_LOCAL, GIT_SETUP"
```

## Remote hinzufügen (GitHub/GitLab)

```bash
# GitHub:
git remote add origin https://github.com/DEIN-USERNAME/localad.git
git push -u origin main

# GitLab:
git remote add origin https://gitlab.com/DEIN-USERNAME/localad.git
git push -u origin main
```

## Empfohlene Branch-Strategie (MVP-Phase)

```
main          → stabiler Stand, immer deploybar
dev           → aktuelle Entwicklung
feature/xxx   → einzelne Features
```

```bash
# Dev-Branch anlegen
git checkout -b dev
```

## .gitignore prüfen

Folgende Dateien/Ordner werden korrekt ausgeschlossen:
- `node_modules/`
- `.env` (alle Varianten)
- `dist/`, `build/`
- `rules/easylist.cache.txt` (EasyList-Cache)
- OS-Dateien (`.DS_Store`, `Thumbs.db`)
