// Einfacher In-Memory Rate Limiter – kein externes Paket nötig.
// Für Multi-Instance-Deployments (mehrere Railway-Prozesse) durch Redis ersetzen.

const stores = new Map(); // key → { count, resetAt }

function createLimiter({ windowMs, max, message }) {
  return (req, res, next) => {
    const key = req.ip + ':' + req.path.split('/')[1]; // IP + erste Route-Ebene
    const now = Date.now();

    let entry = stores.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      stores.set(key, entry);
    }

    entry.count++;

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({ error: message || 'Zu viele Anfragen – bitte warten.' });
    }

    next();
  };
}

// Auth-Endpunkte: max 15 Versuche pro 15 Minuten (Brute-Force-Schutz)
export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Zu viele Login-Versuche. Bitte in 15 Minuten erneut versuchen.',
});

// Ad-Matching: max 120 Anfragen pro Minute pro IP (normale Nutzung ~1–2/Seitenaufruf)
export const adLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Anfrage-Limit erreicht. Bitte kurz warten.',
});

// Generell: max 300 Anfragen pro Minute (alles andere)
export const globalLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 300,
  message: 'Zu viele Anfragen.',
});

// Speicher alle 10 Minuten bereinigen (abgelaufene Einträge entfernen)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of stores) {
    if (now > entry.resetAt) stores.delete(key);
  }
}, 10 * 60 * 1000);
