import { Router } from 'express';
import { createUser, loginUser, refreshTokens } from '../services/authService.js';
import { sendWelcomeMail } from '../services/mailer.js';

export const authRouter = Router();

// ── POST /api/auth/register ───────────────────────────────────────────────────
// Body: { email, password, role?, companyName?, postalCode?, plan? }
// role: 'user' (default) | 'advertiser' | 'publisher'
// Bei 'advertiser': companyName + postalCode erforderlich → Transaktion legt beides an
authRouter.post('/register', async (req, res, next) => {
  try {
    const { email, password, role = 'user', companyName, postalCode, plan } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });
    }
    if (!['user', 'advertiser', 'publisher'].includes(role)) {
      return res.status(400).json({ error: 'Ungültige Rolle' });
    }

    const user = await createUser({
      email: email.toLowerCase().trim(),
      password,
      role,
      companyName,
      postalCode,
      plan,
    });

    // Willkommensmail asynchron senden (kein await – blockiert Response nicht)
    sendWelcomeMail(email.toLowerCase().trim()).catch(() => {});

    res.status(201).json({
      message: role === 'advertiser'
        ? 'Account + Werbetreibenden-Profil erstellt'
        : 'Account erstellt',
      userId: user.id,
      role:   user.role,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });
    }

    const result = await loginUser({ email: email.toLowerCase().trim(), password });

    // Refresh Token als HttpOnly-Cookie setzen (sicherer als localStorage)
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   30 * 24 * 60 * 60 * 1000, // 30 Tage in ms
    });

    res.json({
      accessToken:  result.accessToken,
      refreshToken: result.refreshToken, // für Extension (kein Cookie-Zugriff)
      user:         result.user,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
authRouter.post('/refresh', async (req, res, next) => {
  try {
    // Token aus Cookie oder Body (Fallback für Extension)
    const token = req.cookies?.refresh_token || req.body?.refreshToken;

    if (!token) {
      return res.status(401).json({ error: 'Kein Refresh Token' });
    }

    const tokens = await refreshTokens(token);

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   30 * 24 * 60 * 60 * 1000,
    });

    res.json({ accessToken: tokens.accessToken });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
authRouter.post('/logout', (req, res) => {
  res.clearCookie('refresh_token');
  res.json({ message: 'Abgemeldet' });
});
