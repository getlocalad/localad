/**
 * LocalAd – Cookie-Consent-Banner (DSGVO)
 * Einbinden: <script src="/cookie-banner.js" defer></script> vor </body>
 *
 * LocalAd nutzt ausschließlich technisch notwendige Daten:
 *  - localStorage: JWT-Token (Auth), PLZ, Abo-Status → funktional, kein Tracking
 *  - Stripe: Zahlungsabwicklung → vertragliche Notwendigkeit
 *  - Resend: Transaktionsmails → vertragliche Notwendigkeit
 * Kein Analytics, kein Pixel, keine Drittanbieter-Tracker.
 */
(function () {
  var KEY = 'localad_cookie_consent';
  if (localStorage.getItem(KEY)) return;

  var CSS = `
    #la-cb {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999;
      background: #0C2340;
      border-top: 1px solid rgba(255,255,255,0.1);
      padding: 1.1rem 5%;
      display: flex; gap: 1.5rem; align-items: center; flex-wrap: wrap;
      box-shadow: 0 -4px 32px rgba(0,0,0,0.35);
      animation: la-cb-in 0.25s ease;
    }
    @keyframes la-cb-in {
      from { transform: translateY(100%); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    #la-cb p {
      flex: 1; min-width: 260px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 0.88rem; color: rgba(255,255,255,0.75);
      line-height: 1.6; margin: 0;
    }
    #la-cb p a {
      color: #ff7320; text-decoration: underline;
    }
    #la-cb .la-cb-btns {
      display: flex; gap: 0.65rem; flex-shrink: 0;
    }
    #la-cb button {
      font-family: inherit; font-size: 0.87rem; font-weight: 700;
      padding: 0.55rem 1.35rem; border-radius: 8px;
      cursor: pointer; border: none; transition: opacity 0.15s;
    }
    #la-cb button:hover { opacity: 0.88; }
    #la-cb .la-cb-accept {
      background: #E85D04; color: #fff;
    }
    #la-cb .la-cb-reject {
      background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.75);
      border: 1px solid rgba(255,255,255,0.2) !important;
    }
  `;

  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  var banner = document.createElement('div');
  banner.id = 'la-cb';
  banner.innerHTML =
    '<p>' +
      'Wir verwenden ausschließlich <strong style="color:#fff">technisch notwendige Daten</strong> ' +
      '– für Anmeldung, PLZ-Speicherung und Zahlungsabwicklung via Stripe. ' +
      'Kein Tracking, kein Profiling, keine Weitergabe an Werbenetzwerke. ' +
      '<a href="/datenschutz">Datenschutzerklärung</a>' +
    '</p>' +
    '<div class="la-cb-btns">' +
      '<button class="la-cb-reject" id="la-cb-reject">Nur Notwendige</button>' +
      '<button class="la-cb-accept" id="la-cb-accept">Verstanden &amp; OK</button>' +
    '</div>';

  document.body.appendChild(banner);

  function dismiss(val) {
    localStorage.setItem(KEY, val);
    banner.style.animation = 'la-cb-in 0.2s ease reverse';
    setTimeout(function () { banner.remove(); }, 200);
  }

  document.getElementById('la-cb-accept').addEventListener('click', function () { dismiss('accepted'); });
  document.getElementById('la-cb-reject').addEventListener('click', function () { dismiss('necessary'); });
})();
