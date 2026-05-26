// LocalAd – Background Service Worker (MV3)

import { getApiBase } from '../utils/config.js';

const ONBOARDING_URL = 'https://getlocalad.de/onboarding';

// ── Install: Onboarding öffnen ────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    chrome.tabs.create({ url: ONBOARDING_URL });
  }
});

// ── Startup: Token gegen Backend verifizieren ─────────────────────────────────
chrome.runtime.onStartup.addListener(verifyAuth);

// ── JWT-Hilfsfunktionen ───────────────────────────────────────────────────────
function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch { return null; }
}

function isTokenExpired(token) {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  return Date.now() >= payload.exp * 1000 - 30_000; // 30s Puffer
}

// ── Token holen (mit automatischem Refresh) ───────────────────────────────────
async function getValidToken() {
  const stored = await chrome.storage.local.get(['authToken', 'refreshToken']);
  if (!stored.authToken) return null;

  // Token noch gültig
  if (!isTokenExpired(stored.authToken)) return stored.authToken;

  // Refresh versuchen
  if (!stored.refreshToken) {
    await chrome.storage.local.set({ isSubscribed: false, authToken: null });
    return null;
  }

  try {
    const API_BASE = await getApiBase();
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: stored.refreshToken }),
    });

    if (!res.ok) {
      // Refresh fehlgeschlagen → abmelden
      await chrome.storage.local.set({ isSubscribed: false, authToken: null, refreshToken: null });
      return null;
    }

    const data = await res.json();
    await chrome.storage.local.set({ authToken: data.accessToken });
    return data.accessToken;
  } catch {
    return stored.authToken; // Offline → alten Token behalten
  }
}

// ── Auth verifizieren ─────────────────────────────────────────────────────────
async function verifyAuth() {
  const token = await getValidToken();
  if (!token) return;

  try {
    const API_BASE = await getApiBase();
    const res = await fetch(`${API_BASE}/api/users/me`, {
      headers: { 'Authorization': 'Bearer ' + token },
    });

    if (res.status === 401) {
      await chrome.storage.local.set({ isSubscribed: false, authToken: null });
      return;
    }
    if (!res.ok) return;

    const { user } = await res.json();
    await chrome.storage.local.set({
      isSubscribed: user.is_subscribed ?? false,
      postalCode:   user.postal_code   ?? null,
      userId:       user.id,
    });
  } catch (e) {
    console.debug('[LocalAd] verifyAuth fehlgeschlagen (offline?):', e.message);
  }
}

// ── Nachrichten vom Content Script / Popup / Onboarding ──────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // Onboarding schickt Token nach Login
  if (message.type === 'SET_AUTH') {
    const { token, refreshToken, userId, postalCode, isSubscribed } = message.payload;
    chrome.storage.local.set({ authToken: token, refreshToken, userId, postalCode, isSubscribed })
      .then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'GET_LOCAL_AD') {
    getLocalAd(message.payload)
      .then(ad => sendResponse({ success: true, ad }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'GET_USER_CONFIG') {
    chrome.storage.local.get(['postalCode', 'userId', 'isSubscribed', 'authToken'], config => {
      sendResponse(config);
    });
    return true;
  }

  if (message.type === 'UPDATE_PLZ') {
    const { postalCode } = message.payload;
    getValidToken().then(token => {
      if (!token) { sendResponse({ ok: false, error: 'Nicht eingeloggt' }); return; }
      return updatePlzOnBackend(postalCode, token);
    })
      .then(result => result && sendResponse(result))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

// ── Lokale Ad vom Backend abrufen ─────────────────────────────────────────────
async function getLocalAd({ publisherDomain, slotId, postalCode }) {
  const API_BASE = await getApiBase();
  const response = await fetch(`${API_BASE}/api/ads/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publisherDomain, slotId, postalCode }),
  });
  if (!response.ok) throw new Error('API error: ' + response.status);
  return response.json();
}

// ── PLZ im Backend aktualisieren ──────────────────────────────────────────────
async function updatePlzOnBackend(postalCode, token) {
  const API_BASE = await getApiBase();
  const res = await fetch(`${API_BASE}/api/users/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
    },
    body: JSON.stringify({ postalCode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Fehler beim PLZ-Update');
  }
  await chrome.storage.local.set({ postalCode });
  return { ok: true };
}
