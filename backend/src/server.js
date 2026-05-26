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
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';

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
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

// Dashboard-Dateien statisch ausliefern
app.use(express.static(resolve(__dirname, '../../dashboard')));

// --- Routes ---
app.use('/api/ads', adsRouter);
app.use('/api/publishers', publishersRouter);
app.use('/api/advertisers', advertisersRouter);
app.use('/api/auth', authRouter);
app.use('/api/stripe', stripeRouter);

// --- Health Check ---
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '0.1.0', ts: new Date().toISOString() });
});

// --- Seiten ---
app.get('/onboarding', (req, res) => {
  res.sendFile(resolve(__dirname, '../../dashboard/onboarding.html'));
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
