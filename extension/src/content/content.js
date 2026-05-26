// LocalAd – Content Script
// Läuft auf jeder Seite. Erkennt Ad-Slots registrierter Publisher und ersetzt sie.

// API_BASE wird vom Service Worker verwaltet – Content Script nutzt Nachrichten

(async () => {
  // Nutzerkonfiguration holen
  const config = await sendMessage({ type: 'GET_USER_CONFIG' });

  debug({ step: 'config', config });

  if (!config?.isSubscribed || !config?.postalCode) {
    debug({ step: 'abort', reason: 'kein Abo oder keine PLZ' });
    return;
  }

  const publisherDomain = location.hostname;

  // Ad-Slots finden (Publisher kennzeichnet Slots mit data-localad-slot)
  const slots = document.querySelectorAll('[data-localad-slot]');
  debug({ step: 'slots_found', count: slots.length });
  if (slots.length === 0) return;

  for (const slot of slots) {
    const slotId = slot.getAttribute('data-localad-slot');

    const result = await sendMessage({
      type: 'GET_LOCAL_AD',
      payload: { publisherDomain, slotId, postalCode: config.postalCode }
    });

    debug({ step: 'ad_result', slotId, result });

    if (result?.success && result?.ad) {
      renderAd(slot, result.ad);
    }
  }
})();

function debug(data) {
  window.dispatchEvent(new CustomEvent('localad:debug', { detail: data }));
  console.debug('[LocalAd]', data);
}

function renderAd(slot, ad) {
  // Ursprünglichen Inhalt ersetzen – kein MITM, nur DOM-Manipulation
  slot.innerHTML = '';
  slot.style.position = 'relative';

  const container = document.createElement('div');
  container.className = 'localad-ad';
  container.innerHTML = `
    <a href="${ad.targetUrl}" target="_blank" rel="noopener noreferrer">
      <img src="${ad.imageUrl}" alt="${ad.altText}" style="max-width:100%;display:block;" />
    </a>
    <span class="localad-label">Lokale Anzeige</span>
  `;

  slot.appendChild(container);
}

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}
