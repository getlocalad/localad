import { Router } from 'express';
import { randomBytes, createHash } from 'crypto';
import { createUser, loginUser, refreshTokens } from '../services/authService.js';
import { sendWelcomeMail, sendPasswordResetMail } from '../services/mailer.js';
import { pool } from '../db/db.js';

export const authRouter = Router();

// ── POST /api/auth/register ───────────────────────────────────────────────────
// Body: { email, password }
// Erstellt immer einen normalen User-Account. Upgrades (Advertiser, Publisher) separat.
authRouter.post('/register', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });
    }

    const user = await createUser({ email: email.toLowerCase().trim(), password });
    sendWelcomeMail(email.toLowerCase().trim()).catch(() => {});

    res.status(201).json({ message: 'Account erstellt', userId: user.id });
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

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
// Body: { email }
// Erzeugt einen Reset-Token (1h gültig) und schickt ihn per Mail.
// Antwortet immer 200 – kein Hinweis ob E-Mail existiert (Anti-Enumeration).
authRouter.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'E-Mail erforderlich' });

    const normalizedEmail = email.toLowerCase().trim();

    // Nutzer suchen
    const { rows } = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (rows.length > 0) {
      const userId = rows[0].id;

      // Alten Token löschen (Rate-Limit: max. 1 offener Token pro User)
      await pool.query(
        'DELETE FROM password_reset_tokens WHERE user_id = $1',
        [userId]
      );

      // Neuen Token erzeugen (32 Bytes → 64 Hex-Zeichen)
      const rawToken  = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // +1h

      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, rawToken, expiresAt]
      );

      // Mail asynchron senden
      sendPasswordResetMail(normalizedEmail, rawToken).catch(() => {});
    }

    // Immer gleiche Antwort (kein Leak ob E-Mail existiert)
    res.json({ message: 'Falls die E-Mail registriert ist, wurde ein Link gesendet.' });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/reset-password ────────────────────────────────────────────
// Body: { token, password }
// Prüft Token, setzt neues Passwort, markiert Token als verbraucht.
authRouter.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token und Passwort erforderlich' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben' });
    }

    // Token prüfen (nicht abgelaufen, nicht benutzt)
    const { rows } = await pool.query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token = $1
         AND expires_at > NOW()
         AND used_at IS NULL`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Link ungültig oder abgelaufen' });
    }

    const { id: tokenId, user_id: userId } = rows[0];

    // Passwort hashen
    const bcrypt = await import('bcrypt');
    const hash   = await bcrypt.default.hash(password, 12);

    // Passwort setzen + Token verbrauchen (Transaktion)
    await pool.query('BEGIN');
    try {
      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [hash, userId]
      );
      await pool.query(
        'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
        [tokenId]
      );
      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }

    res.json({ message: 'Passwort erfolgreich geändert' });
  } catch (err) {
    next(err);
  }
});
