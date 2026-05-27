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
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { authLimiter, adLimiter, globalLimiter } from './middleware/rateLimiter.js';

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

// --- Routes ---
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/ads', adLimiter, adsRouter);
app.use('/api/publishers', globalLimiter, publishersRouter);
app.use('/api/advertisers', globalLimiter, advertisersRouter);
app.use('/api/users', globalLimiter, usersRouter);
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
