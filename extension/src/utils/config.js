// LocalAd – Zentrale Konfiguration
// API_BASE wird aus chrome.storage.local gelesen.
// Fallback: Dev-URL, damit die Extension ohne Setup sofort testbar ist.

const DEFAULTS = {
  apiBase:     'http://localhost:3000',
  environment: 'development',
};

// Production-URL – wird gesetzt sobald wir deployen
const PRODUCTION_API = 'https://api.getlocalad.de';

// ── Config laden (cached, wird einmalig gelesen) ──────────────────────────────
let _cache = null;

export async function getConfig() {
  if (_cache) return _cache;

  const stored = await chrome.storage.local.get(['apiBase', 'environment']);

  _cache = {
    apiBase:     stored.apiBase     ?? DEFAULTS.apiBase,
    environment: stored.environment ?? DEFAULTS.environment,
  };

  return _cache;
}

// ── API-Base-URL holen (Shortcut) ─────────────────────────────────────────────
export async function getApiBase() {
  const config = await getConfig();
  return config.apiBase;
}

// ── Config überschreiben (z.B. aus Admin-Popup) ───────────────────────────────
export async function setConfig(updates) {
  await chrome.storage.local.set(updates);
  _cache = null; // Cache invalidieren
}

// ── Auf Production-URL wechseln ───────────────────────────────────────────────
export async function switchToProduction() {
  await setConfig({ apiBase: PRODUCTION_API, environment: 'production' });
}

// ── Auf Dev-URL zurückwechseln ────────────────────────────────────────────────
export async function switchToDevelopment() {
  await setConfig({ apiBase: DEFAULTS.apiBase, environment: 'development' });
}
