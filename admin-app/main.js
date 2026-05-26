import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import pg from 'pg';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Env laden ────────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = resolve(__dirname, '../backend/.env');
  if (!existsSync(envPath)) return {};
  const env = {};
  readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && !key.startsWith('#')) env[key.trim()] = rest.join('=').trim();
  });
  return env;
}

const env = loadEnv();

// ── DB-Pool ───────────────────────────────────────────────────────────────────
let pool = null;
function getPool() {
  if (pool) return pool;
  try {
    pool = new Pool(
      env.DATABASE_URL
        ? { connectionString: env.DATABASE_URL, ssl: false }
        : {
            host:     env.DB_HOST     || 'localhost',
            port:     parseInt(env.DB_PORT || '5432'),
            database: env.DB_NAME     || 'localad',
            user:     env.DB_USER     || 'localad',
            password: env.DB_PASSWORD,
          }
    );
  } catch (e) { console.error('DB Pool Fehler:', e.message); }
  return pool;
}

// ── Backend-Prozess ───────────────────────────────────────────────────────────
let backendProcess = null;
const backendDir = resolve(__dirname, '../backend');

// ── Fenster ───────────────────────────────────────────────────────────────────
let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: join(__dirname, '../extension/assets/icons/icon128.png'),
  });
  win.loadFile(join(__dirname, 'renderer/index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill();
  app.quit();
});

// ── IPC: Stats ────────────────────────────────────────────────────────────────
ipcMain.handle('get-stats', async () => {
  try {
    const p = getPool();
    const [users, advertisers, publishers, impressions, clicks] = await Promise.all([
      p.query('SELECT COUNT(*) FROM users'),
      p.query('SELECT COUNT(*) FROM advertisers WHERE is_active = true'),
      p.query('SELECT COUNT(*) FROM publishers WHERE is_verified = true'),
      p.query('SELECT COUNT(*) FROM impressions'),
      p.query('SELECT COUNT(*) FROM impressions WHERE clicked = true'),
    ]);
    return {
      users:       parseInt(users.rows[0].count),
      advertisers: parseInt(advertisers.rows[0].count),
      publishers:  parseInt(publishers.rows[0].count),
      impressions: parseInt(impressions.rows[0].count),
      clicks:      parseInt(clicks.rows[0].count),
    };
  } catch (e) { return { error: e.message }; }
});

// ── IPC: Advertiser-Liste ─────────────────────────────────────────────────────
ipcMain.handle('get-advertisers', async () => {
  try {
    const p = getPool();
    const r = await p.query(`
      SELECT a.id, a.company_name, a.postal_code, a.plan, a.is_active,
             u.email, a.created_at,
             COUNT(ads.id) AS ad_count
      FROM advertisers a
      JOIN users u ON u.id = a.user_id
      LEFT JOIN ads ON ads.advertiser_id = a.id
      GROUP BY a.id, u.email
      ORDER BY a.created_at DESC
    `);
    return { rows: r.rows };
  } catch (e) { return { error: e.message }; }
});

// ── IPC: Publisher-Liste ──────────────────────────────────────────────────────
ipcMain.handle('get-publishers', async () => {
  try {
    const p = getPool();
    const r = await p.query(`
      SELECT pub.id, pub.domain, pub.is_verified, pub.verification_method,
             pub.revenue_share_pct, u.email, pub.created_at
      FROM publishers pub
      JOIN users u ON u.id = pub.user_id
      ORDER BY pub.created_at DESC
    `);
    return { rows: r.rows };
  } catch (e) { return { error: e.message }; }
});

// ── IPC: Advertiser togglen ───────────────────────────────────────────────────
ipcMain.handle('toggle-advertiser', async (_, { id, active }) => {
  try {
    const p = getPool();
    await p.query('UPDATE advertisers SET is_active = $1 WHERE id = $2', [active, id]);
    return { ok: true };
  } catch (e) { return { error: e.message }; }
});

// ── IPC: Publisher togglen ────────────────────────────────────────────────────
ipcMain.handle('toggle-publisher', async (_, { id, verified }) => {
  try {
    const p = getPool();
    await p.query('UPDATE publishers SET is_verified = $1 WHERE id = $2', [verified, id]);
    return { ok: true };
  } catch (e) { return { error: e.message }; }
});

// ── IPC: Health-Check ─────────────────────────────────────────────────────────
ipcMain.handle('health-check', async (_, url) => {
  try {
    const r = await fetch(url + '/health');
    const data = await r.json();
    return { ok: r.ok, data };
  } catch (e) { return { ok: false, error: e.message }; }
});

// ── IPC: Backend starten ──────────────────────────────────────────────────────
ipcMain.handle('start-backend', async () => {
  if (backendProcess) return { ok: false, error: 'Backend läuft bereits' };
  try {
    backendProcess = spawn('node', ['--env-file=.env', '--watch', 'src/server.js'], {
      cwd: backendDir,
      shell: true,
    });
    backendProcess.stdout.on('data', d => win?.webContents.send('backend-log', d.toString()));
    backendProcess.stderr.on('data', d => win?.webContents.send('backend-log', '[ERR] ' + d.toString()));
    backendProcess.on('exit', () => {
      backendProcess = null;
      win?.webContents.send('backend-status', false);
    });
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});

// ── IPC: Backend stoppen ──────────────────────────────────────────────────────
ipcMain.handle('stop-backend', async () => {
  if (!backendProcess) return { ok: false, error: 'Backend läuft nicht' };
  backendProcess.kill();
  backendProcess = null;
  return { ok: true };
});

// ── IPC: Backend-Status ───────────────────────────────────────────────────────
ipcMain.handle('backend-running', () => ({ running: !!backendProcess }));

// ── IPC: Link öffnen ──────────────────────────────────────────────────────────
ipcMain.handle('open-link', (_, url) => shell.openExternal(url));
