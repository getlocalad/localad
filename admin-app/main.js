import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { spawn, execSync } from 'node:child_process';
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
    if (key && key.trim() && !key.startsWith('#')) env[key.trim()] = rest.join('=').trim();
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
    // Verbindungsfehler direkt abfangen statt beim ersten Query zu crashen
    pool.on('error', (e) => console.error('DB Pool Fehler:', e.message));
  } catch (e) {
    console.error('DB Pool Init Fehler:', e.message);
  }
  return pool;
}

// ── Backend-Prozess ───────────────────────────────────────────────────────────
let backendProcess = null;
const backendDir = resolve(__dirname, '../backend');

// Findet die PID die auf einem Port lauscht und killt sie (Windows)
function killPort(port) {
  if (process.platform !== 'win32') return;
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { shell: true, encoding: 'utf8' });
    const pids = new Set();
    out.split('\n').forEach(line => {
      // Nur LISTENING-Zeilen → echte Server-Prozesse
      if (!line.includes('LISTENING')) return;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') pids.add(pid);
    });
    pids.forEach(pid => {
      try { execSync(`taskkill /F /PID ${pid}`, { shell: true, stdio: 'ignore' }); } catch (e) {}
    });
  } catch (e) { /* nichts lauscht auf dem Port */ }
}

// ── Fenster ───────────────────────────────────────────────────────────────────
let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      devTools: true,
    },
    icon: join(__dirname, '../extension/assets/icons/icon128.png'),
  });
  win.loadFile(join(__dirname, 'renderer/index.html'));

  // DevTools nur im Dev-Modus
  if (process.argv.includes('--dev')) {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (backendProcess) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/F', '/T', '/PID', String(backendProcess.pid)], { shell: true });
      } else {
        backendProcess.kill('SIGTERM');
      }
    } catch (e) { /* ignore */ }
    backendProcess = null;
  }
  app.quit();
});

// ── IPC: Stats ────────────────────────────────────────────────────────────────
ipcMain.handle('get-stats', async () => {
  try {
    const p = getPool();
    if (!p) return { error: 'Keine DB-Verbindung – .env prüfen' };
    const [users, advertisers, publishers, impressions, clicks, subUsers, advPlans] = await Promise.all([
      p.query('SELECT COUNT(*) FROM users'),
      p.query('SELECT COUNT(*) FROM advertisers WHERE is_active = true'),
      p.query('SELECT COUNT(*) FROM publishers WHERE is_verified = true'),
      p.query('SELECT COUNT(*) FROM impressions'),
      p.query('SELECT COUNT(*) FROM impressions WHERE clicked = true'),
      // Aktive Nutzer-Abos (3 €/Monat)
      p.query("SELECT COUNT(*) FROM users WHERE is_subscribed = true AND subscription_end > NOW()"),
      // Advertiser-Pläne (basic 29€, premium 79€/Monat)
      p.query("SELECT plan, COUNT(*) FROM advertisers WHERE is_active = true GROUP BY plan"),
    ]);

    // MRR berechnen
    const subscribedUsers = parseInt(subUsers.rows[0].count) * 3;
    const advRevenue = advPlans.rows.reduce((sum, row) => {
      const price = row.plan === 'premium' ? 79 : 29;
      return sum + parseInt(row.count) * price;
    }, 0);
    const mrr = subscribedUsers + advRevenue;

    return {
      users:       parseInt(users.rows[0].count),
      advertisers: parseInt(advertisers.rows[0].count),
      publishers:  parseInt(publishers.rows[0].count),
      impressions: parseInt(impressions.rows[0].count),
      clicks:      parseInt(clicks.rows[0].count),
      revenue:     mrr,
    };
  } catch (e) { return { error: e.message }; }
});

// ── IPC: Advertiser-Liste ─────────────────────────────────────────────────────
ipcMain.handle('get-advertisers', async () => {
  try {
    const p = getPool();
    if (!p) return { error: 'Keine DB-Verbindung' };
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
    if (!p) return { error: 'Keine DB-Verbindung' };
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

// ── IPC: Ads-Liste ────────────────────────────────────────────────────────────
ipcMain.handle('get-ads', async () => {
  try {
    const p = getPool();
    if (!p) return { error: 'Keine DB-Verbindung' };
    const r = await p.query(`
      SELECT ads.id, ads.title, ads.postal_code, ads.is_active,
             a.company_name, ads.created_at,
             COUNT(imp.id) AS impressions,
             COUNT(imp.id) FILTER (WHERE imp.clicked = true) AS clicks
      FROM ads
      JOIN advertisers a ON a.id = ads.advertiser_id
      LEFT JOIN impressions imp ON imp.ad_id = ads.id
      GROUP BY ads.id, a.company_name
      ORDER BY ads.created_at DESC
      LIMIT 100
    `);
    return { rows: r.rows };
  } catch (e) { return { error: e.message }; }
});

// ── IPC: Nutzer-Liste ─────────────────────────────────────────────────────────
ipcMain.handle('get-users', async () => {
  try {
    const p = getPool();
    if (!p) return { error: 'Keine DB-Verbindung' };
    const r = await p.query(`
      SELECT id, email, postal_code, is_subscribed, subscription_end, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 500
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

// ── IPC: Ad togglen ──────────────────────────────────────────────────────────
ipcMain.handle('toggle-ad', async (_, { id, active }) => {
  try {
    const p = getPool();
    await p.query('UPDATE ads SET is_active = $1 WHERE id = $2', [active, id]);
    return { ok: true };
  } catch (e) { return { error: e.message }; }
});

// ── IPC: Health-Check ─────────────────────────────────────────────────────────
ipcMain.handle('health-check', async (_, url) => {
  try {
    const r = await fetch(url + '/health', { signal: AbortSignal.timeout(5000) });
    const data = await r.json();
    return { ok: r.ok, data };
  } catch (e) { return { ok: false, error: e.message }; }
});

// ── IPC: Backend starten ──────────────────────────────────────────────────────
ipcMain.handle('start-backend', async () => {
  if (backendProcess) return { ok: false, error: 'Backend läuft bereits' };
  // Port freimachen falls noch ein alter Prozess hängt
  killPort(3000);
  await new Promise(r => setTimeout(r, 300));
  try {
    // dotenv via -r statt --env-file (funktioniert mit allen Node-Versionen)
    backendProcess = spawn('node', ['src/server.js'], {
      cwd: backendDir,
      shell: true,
      env: { ...process.env, ...env, NODE_ENV: 'development' },
    });
    backendProcess.stdout.on('data', d =>
      win?.webContents.send('backend-log', d.toString().trimEnd())
    );
    backendProcess.stderr.on('data', d =>
      win?.webContents.send('backend-log', '[ERR] ' + d.toString().trimEnd())
    );
    backendProcess.on('exit', (code) => {
      backendProcess = null;
      win?.webContents.send('backend-status', false);
      win?.webContents.send('backend-log', `[SYS] Prozess beendet (Code ${code})`);
    });
    // Kurz warten und prüfen ob Prozess sofort gecrasht ist
    await new Promise(r => setTimeout(r, 500));
    if (!backendProcess) return { ok: false, error: 'Backend sofort gecrasht – Logs prüfen' };
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});

// ── IPC: Backend stoppen ──────────────────────────────────────────────────────
ipcMain.handle('stop-backend', async () => {
  if (!backendProcess) return { ok: false, error: 'Backend läuft nicht' };
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/F', '/T', '/PID', String(backendProcess.pid)], { shell: true });
    } else {
      backendProcess.kill('SIGTERM');
    }
  } catch (e) { console.error('Stop-Fehler:', e.message); }
  backendProcess = null;
  // Fallback: Port-basiertes Cleanup (killt den echten Node-Prozess per netstat)
  await new Promise(r => setTimeout(r, 400));
  killPort(3000);
  return { ok: true };
});

// ── IPC: Backend-Status ───────────────────────────────────────────────────────
ipcMain.handle('backend-running', () => ({ running: !!backendProcess }));

// ── IPC: Link öffnen ──────────────────────────────────────────────────────────
ipcMain.handle('open-link', (_, url) => shell.openExternal(url));
