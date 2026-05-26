// LocalAd – Background Service Worker (MV3)
// Verantwortlich für: API-Kommunikation, Regelwerk-Updates, Nutzer-Auth

import { getApiBase } from '../utils/config.js';

// --- Init ---
const ONBOARDING_URL = 'http://localhost:3000/onboarding'; // → später dashboard/onboarding.html hosten

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    console.log('[LocalAd] Extension installiert – öffne Onboarding');
    chrome.tabs.create({ url: ONBOARDING_URL });
  }
});

// --- Nachrichten vom Content Script ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_LOCAL_AD') {
    getLocalAd(message.payload)
      .then(ad => sendResponse({ success: true, ad }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // async
  }

  if (message.type === 'GET_USER_CONFIG') {
    chrome.storage.local.get(['postalCode', 'userId', 'isSubscribed'], config => {
      sendResponse(config);
    });
    return true;
  }
});

// --- Lokale Ad vom Backend abrufen ---
async function getLocalAd({ publisherDomain, slotId, postalCode }) {
  const API_BASE = await getApiBase();
  const response = await fetch(`${API_BASE}/api/ads/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publisherDomain, slotId, postalCode })
  });

  if (!response.ok) throw new Error('API error: ' + response.status);
  return response.json();
}
