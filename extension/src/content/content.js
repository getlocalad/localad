// LocalAd – Content Script
// Läuft auf jeder Seite. Erkennt Ad-Slots registrierter Publisher und ersetzt sie.

// ── Fallback-Kacheln (kuratierte Duisburg-Links) ──────────────────────────────
const FALLBACK_CARDS = [
  {
    title: 'Duisburg.de – Das offizielle Stadtportal',
    url: 'https://www.duisburg.de',
    displayUrl: 'duisburg.de',
    description: 'Aktuelle Informationen zu Ämtern, Veranstaltungen und Services der Stadt Duisburg.',
  },
  {
    title: 'Duisburger Akzente – Festival der Kulturen',
    url: 'https://www.duisburger-akzente.de',
    displayUrl: 'duisburger-akzente.de',
    description: 'Das größte Kulturfestival in Duisburg mit Konzerten, Lesungen und Ausstellungen.',
  },
  {
    title: 'Stadtwerke Duisburg – Strom, Gas & mehr',
    url: 'https://www.stadtwerke-duisburg.de',
    displayUrl: 'stadtwerke-duisburg.de',
    description: 'Energie und Mobilität aus der Region – Tarife, Beratung und lokaler Service.',
  },
  {
    title: 'Mercator-Halle Duisburg – Veranstaltungen',
    url: 'https://www.mercatorhalle.de',
    displayUrl: 'mercatorhalle.de',
    description: 'Konzerte, Kongresse und Events im Herzen von Duisburg.',
  },
  {
    title: 'Zoo Duisburg – Erlebnis für die ganze Familie',
    url: 'https://www.zoo-duisburg.de',
    displayUrl: 'zoo-duisburg.de',
    description: 'Einer der beliebtesten Zoos Deutschlands mit über 3.000 Tieren direkt in Duisburg.',
  },
  {
    title: 'Duisburg Kontor – Tourismus & Marketing',
    url: 'https://www.duisburgkontor.de',
    displayUrl: 'duisburgkontor.de',
    description: 'Ausflugstipps, Stadtführungen und Veranstaltungskalender für Duisburg.',
  },
  {
    title: 'Lehmbruck Museum – Skulpturen aus aller Welt',
    url: 'https://www.lehmbruckmuseum.de',
    displayUrl: 'lehmbruckmuseum.de',
    description: 'Internationales Museum für moderne Skulptur im Herzen von Duisburg.',
  },
  {
    title: 'DVG – Busse & Bahnen in Duisburg',
    url: 'https://www.dvg-duisburg.de',
    displayUrl: 'dvg-duisburg.de',
    description: 'Fahrpläne, Tickets und aktuelle Meldungen des Duisburger Nahverkehrs.',
  },
  {
    title: 'Innenhafen Duisburg – Leben am Wasser',
    url: 'https://www.innenhafen-duisburg.de',
    displayUrl: 'innenhafen-duisburg.de',
    description: 'Restaurants, Galerien und Events im historischen Innenhafen.',
  },
  {
    title: 'Ruhr Tourismus – Entdecke das Ruhrgebiet',
    url: 'https://www.ruhr-tourismus.de',
    displayUrl: 'ruhr-tourismus.de',
    description: 'Ausflugsziele, Radwege und Sehenswürdigkeiten rund um Duisburg und das Ruhrgebiet.',
  },
];

// Gemischte Reihenfolge damit immer andere Kacheln erscheinen
function getShuffledFallbacks() {
  return [...FALLBACK_CARDS].sort(() => Math.random() - 0.5);
}

const fallbackQueue = getShuffledFallbacks();
let fallbackIndex = 0;

function nextFallback() {
  const card = fallbackQueue[fallbackIndex % fallbackQueue.length];
  fallbackIndex++;
  return card;
}

// ── Hauptlogik ────────────────────────────────────────────────────────────────
(async () => {
  const config = await sendMessage({ type: 'GET_USER_CONFIG' });

  debug({ step: 'config', config });

  if (!config?.isSubscribed || !config?.postalCode) {
    debug({ step: 'abort', reason: 'kein Abo oder keine PLZ' });
    return;
  }

  const publisherDomain = location.hostname;

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
    } else {
      // Kein passender Werbetreibender → Fallback-Snippet anzeigen
      renderFallback(slot, nextFallback());
      debug({ step: 'fallback_shown', slotId });
    }
  }
})();

// ── Render: lokale Anzeige ────────────────────────────────────────────────────
function renderAd(slot, ad) {
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

// ── Render: Fallback-Snippet (Google-Stil) ────────────────────────────────────
function renderFallback(slot, card) {
  slot.innerHTML = '';
  slot.style.position = 'relative';

  const container = document.createElement('div');
  container.className = 'localad-fallback';
  container.style.cssText = [
    'font-family: Arial, sans-serif',
    'padding: 10px 14px',
    'background: #fff',
    'border: 1px solid #e0e0e0',
    'border-radius: 8px',
    'max-width: 600px',
    'box-shadow: 0 1px 3px rgba(0,0,0,0.08)',
    'cursor: pointer',
  ].join(';');

  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
      <div style="width:20px;height:20px;background:#E85D04;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
        <span style="color:#fff;font-size:11px;font-weight:700;">L</span>
      </div>
      <span style="font-size:13px;color:#202124;font-weight:500;">${escHtml(card.displayUrl)}</span>
      <span style="font-size:11px;color:#70757a;background:#f1f3f4;border-radius:3px;padding:1px 6px;margin-left:auto;">Lokaltipp</span>
    </div>
    <a href="${escAttr(card.url)}" target="_blank" rel="noopener noreferrer"
       style="font-size:17px;color:#1a0dab;text-decoration:none;font-weight:500;line-height:1.3;display:block;margin-bottom:4px;">
      ${escHtml(card.title)}
    </a>
    <p style="font-size:13px;color:#4d5156;margin:0;line-height:1.5;">
      ${escHtml(card.description)}
    </p>
  `;

  // Klick auf Container öffnet Link
  container.addEventListener('click', (e) => {
    if (e.target.tagName !== 'A') {
      window.open(card.url, '_blank', 'noopener,noreferrer');
    }
  });

  slot.appendChild(container);
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function debug(data) {
  window.dispatchEvent(new CustomEvent('localad:debug', { detail: data }));
  console.debug('[LocalAd]', data);
}

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}
