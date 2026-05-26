// LocalAd – Popup Logic
import { getConfig, setConfig, switchToProduction, switchToDevelopment } from '../utils/config.js';

const postalInput = document.getElementById('postalCode');
const saveBtn     = document.getElementById('saveBtn');
const statusEl    = document.getElementById('status');
const subStatusEl = document.getElementById('subStatus');
const envBadge    = document.getElementById('envBadge');

// ── Gespeicherte Werte laden ──────────────────────────────────────────────────
(async () => {
  const [stored, config] = await Promise.all([
    new Promise(r => chrome.storage.local.get(['postalCode', 'isSubscribed'], r)),
    getConfig(),
  ]);

  if (stored.postalCode) postalInput.value = stored.postalCode;

  subStatusEl.textContent  = stored.isSubscribed ? 'Aktiv' : 'Kein Abo';
  subStatusEl.style.background = stored.isSubscribed ? '#dcfce7' : '#fee2e2';
  subStatusEl.style.color  = stored.isSubscribed ? '#166534' : '#991b1b';

  renderEnv(config.environment);
})();

// ── Umgebungs-Badge ───────────────────────────────────────────────────────────
function renderEnv(env) {
  envBadge.textContent = env === 'production' ? 'Production' : 'Dev (local)';
  envBadge.style.background = env === 'production' ? '#dcfce7' : '#fef3c7';
  envBadge.style.color      = env === 'production' ? '#166534' : '#92400e';
}

envBadge.addEventListener('click', async () => {
  const config = await getConfig();
  if (config.environment === 'production') {
    await switchToDevelopment();
    renderEnv('development');
  } else {
    await switchToProduction();
    renderEnv('production');
  }
});

// ── PLZ speichern + ans Backend syncen ───────────────────────────────────────
saveBtn.addEventListener('click', async () => {
  const plz = postalInput.value.trim();
  if (!/^\d{5}$/.test(plz)) {
    postalInput.style.borderColor = '#ef4444';
    return;
  }
  postalInput.style.borderColor = '';
  saveBtn.disabled = true;

  // Lokal speichern
  await chrome.storage.local.set({ postalCode: plz });

  // An Backend syncen (Service Worker übernimmt den API-Call)
  const stored = await new Promise(r => chrome.storage.local.get(['authToken'], r));
  if (stored.authToken) {
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'UPDATE_PLZ',
        payload: { postalCode: plz, token: stored.authToken },
      });
      if (result && !result.ok) {
        console.warn('[LocalAd] PLZ-Sync fehlgeschlagen:', result.error);
      }
    } catch (e) {
      console.warn('[LocalAd] PLZ-Sync Fehler:', e.message);
    }
  }

  saveBtn.disabled = false;
  statusEl.classList.add('visible');
  setTimeout(() => statusEl.classList.remove('visible'), 2000);
});
