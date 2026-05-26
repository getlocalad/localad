// Packt die Extension als .zip für den Chrome Web Store
// Ausführen: node scripts/zip.js

import archiver from 'archiver';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT  = path.resolve(ROOT, '..', 'dist');

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const output  = fs.createWriteStream(path.join(OUT, 'localad-extension.zip'));
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`[Zip] ${archive.pointer()} bytes → dist/localad-extension.zip`);
});

archive.on('error', err => { throw err; });
archive.pipe(output);

// Alles außer node_modules und scripts einpacken
archive.glob('**/*', {
  cwd: ROOT,
  ignore: ['node_modules/**', 'scripts/**', '*.zip', 'package*.json'],
});

archive.finalize();
