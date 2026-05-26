// Firefox-Build: erstellt localad-firefox.xpi (= .zip mit .xpi-Extension)
// Firefox unterstützt MV3 ab v109, declarativeNetRequestWithHostAccess ab v121.
// Wir entfernen die Permission für ältere Firefox-Versionen und passen das Manifest an.

import archiver from 'archiver';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT  = path.resolve(ROOT, '..', 'dist');

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// Manifest laden und Firefox-kompatibel anpassen
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));

// Permissions bereinigen: declarativeNetRequestWithHostAccess erst ab Firefox 121
// Für Kompatibilität ab 109 entfernen wir es (host_permissions reicht)
manifest.permissions = manifest.permissions.filter(
  p => p !== 'declarativeNetRequestWithHostAccess'
);

// Minimale Version auf 121 anheben wenn wir die Permission behalten wollen,
// ODER auf 109 belassen und Permission weglassen (konservative Wahl)
manifest.browser_specific_settings.gecko.strict_min_version = '109.0';

const tmpManifest = path.join(ROOT, 'manifest.firefox-tmp.json');
fs.writeFileSync(tmpManifest, JSON.stringify(manifest, null, 2));

const output  = fs.createWriteStream(path.join(OUT, 'localad-firefox.xpi'));
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  fs.unlinkSync(tmpManifest);
  console.log(`[Firefox] ${archive.pointer()} bytes → dist/localad-firefox.xpi`);
  console.log('[Firefox] Installieren: about:debugging → "Temporäre Add-on laden" → .xpi auswählen');
  console.log('[Firefox] Produktion:   addons.mozilla.org → Neue Version hochladen');
});

archive.on('error', err => { fs.unlinkSync(tmpManifest); throw err; });
archive.pipe(output);

// manifest.json durch angepasste Version ersetzen
archive.file(tmpManifest, { name: 'manifest.json' });

// Rest der Extension (ohne das Original-Manifest)
archive.glob('**/*', {
  cwd: ROOT,
  ignore: [
    'node_modules/**',
    'scripts/**',
    '*.zip', '*.xpi',
    'package*.json',
    'manifest.json',          // wird durch angepasste Version ersetzt
    'manifest.firefox-tmp.json',
  ],
});

archive.finalize();
