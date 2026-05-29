import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { adsRouter } from './routes/ads.js';
import { publishersRouter } from './routes/publishers.js';
import { advertisersRouter } from './routes/advertisers.js';
import { authRouter } from './routes/auth.js';
import { stripeRouter } from './routes/stripe.js';
import { usersRouter } from './routes/users.js';
import { uploadRouter } from './routes/upload.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { authLimiter, adLimiter, globalLimiter } from './middleware/rateLimiter.js';
import { sendContactMail } from './services/mailer.js';

// __dirname-Ersatz fuer ES-Module
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// --- Stripe Webhook (Raw Body MUSS vor express.json stehen) ---
app.use(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  stripeRouter
);

// --- Middleware ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'script-src':      ["'self'", "'unsafe-inline'"],
      'script-src-attr': ["'unsafe-inline'"],
      'img-src':         ["'self'", 'data:', 'https:'],
    },
  },
}));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

// Statische Assets ausliefern (kein Auto-Index – Routen steuern HTML-Seiten)
app.use(express.static(resolve(__dirname, '../../dashboard'), { index: false }));
// Hochgeladene Bilder statisch ausliefern
app.use('/uploads', express.static(resolve(__dirname, '../../../uploads')));

// --- Routes ---
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/ads', adLimiter, adsRouter);
app.use('/api/publishers', globalLimiter, publishersRouter);
app.use('/api/advertisers', globalLimiter, advertisersRouter);
app.use('/api/users', globalLimiter, usersRouter);
app.use('/api/upload', globalLimiter, uploadRouter);
app.use('/api/stripe', stripeRouter);

// --- Health Check ---
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '0.1.0', ts: new Date().toISOString() });
});

// --- www → apex Redirect ---
app.use((req, res, next) => {
  if (req.hostname === 'www.getlocalad.de') {
    return res.redirect(301, 'https://getlocalad.de' + req.originalUrl);
  }
  next();
});

// --- Seiten ---
app.get('/', (req, res) => {
  res.sendFile(resolve(__dirname, '../../dashboard/landing.html'));
});
app.get('/dashboard', (req, res) => {
  res.sendFile(resolve(__dirname, '../../dashboard/index.html'));
});
app.get('/onboarding', (req, res) => {
  res.sendFile(resolve(__dirname, '../../dashboard/onboarding.html'));
});
app.get('/publisher', (req, res) => {
  res.sendFile(resolve(__dirname, '../../dashboard/publisher.html'));
});
app.get('/impressum', (req, res) => {
  res.sendFile(resolve(__dirname, '../../dashboard/impressum.html'));
});
app.get('/datenschutz', (req, res) => {
  res.sendFile(resolve(__dirname, '../../dashboard/datenschutz.html'));
});
app.get('/agb', (req, res) => {
  res.sendFile(resolve(__dirname, '../../dashboard/agb.html'));
});
app.get('/account', (req, res) => {
  res.sendFile(resolve(__dirname, '../../dashboard/account.html'));
});
app.get('/demo', (req, res) => {
  res.sendFile(resolve(__dirname, '../../dashboard/demo.html'));
});
app.get('/kontakt', (req, res) => {
  res.sendFile(resolve(__dirname, '../../dashboard/kontakt.html'));
});
app.post('/api/contact', globalLimiter, async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, E-Mail und Nachricht sind Pflichtfelder.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Ungültige E-Mail-Adresse.' });
    }
    if (message.length > 5000) {
      return res.status(400).json({ error: 'Nachricht zu lang (max. 5000 Zeichen).' });
    }
    await sendContactMail({ name, email, subject: subject || 'allgemein', message });
    res.json({ ok: true });
  } catch (err) {
    console.error('[Contact]', err.message);
    res.status(500).json({ error: 'Fehler beim Senden. Bitte versuche es später erneut.' });
  }
});

// Catch-all: unbekannte Routen → Landing Page (verhindert Railway-Fallback)
app.get('*', (req, res) => {
  res.sendFile(resolve(__dirname, '../../dashboard/landing.html'));
});

// Stripe Success/Cancel Redirects
app.get('/success', (req, res) => {
  res.redirect('/onboarding?success=1&plz=' + (req.query.plz ?? ''));
});
app.get('/cancel', (req, res) => {
  res.redirect('/onboarding?cancel=1');
});

// --- Error Handler (muss zuletzt stehen) ---
app.use(errorHandler);

app.listen(PORT, () => {
  console.log('[LocalAd API] laeuft auf Port ' + PORT);
});

export default app;
