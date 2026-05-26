import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db/db.js';

const SALT_ROUNDS    = 12;
const ACCESS_TTL     = process.env.JWT_EXPIRES_IN         || '15m';
const REFRESH_TTL    = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
const JWT_SECRET     = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET + '_refresh';

// ── Passwort-Hashing ──────────────────────────────────────────────────────────
export const hashPassword   = (plain) => bcrypt.hash(plain, SALT_ROUNDS);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

// ── Token-Generierung ─────────────────────────────────────────────────────────
export function signAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TTL });
}

export function signRefreshToken(payload) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

// ── User anlegen ──────────────────────────────────────────────────────────────
// role: 'user' | 'advertiser' | 'publisher'
// Bei 'advertiser' wird in derselben Transaktion ein advertisers-Eintrag angelegt.
export async function createUser({ email, password, role = 'user', companyName, postalCode, plan = 'basic' }) {
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    const err = new Error('E-Mail bereits registriert');
    err.status = 409;
    throw err;
  }

  const password_hash = await hashPassword(password);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email`,
      [email, password_hash]
    );
    const user = userResult.rows[0];

    if (role === 'advertiser') {
      if (!companyName || !postalCode) {
        throw Object.assign(new Error('companyName und postalCode für Werbetreibende erforderlich'), { status: 400 });
      }
      await client.query(
        `INSERT INTO advertisers (user_id, company_name, contact_email, postal_code, plan)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, companyName, email, postalCode, plan]
      );
    }

    if (role === 'publisher') {
      // Publisher-Eintrag wird separat per /publishers/register angelegt (braucht Domain-Angabe)
      // Hier nur User anlegen – kein extra Eintrag nötig
    }

    await client.query('COMMIT');
    return { ...user, role };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Login ─────────────────────────────────────────────────────────────────────
export async function loginUser({ email, password }) {
  const result = await pool.query(
    `SELECT u.id, u.email, u.password_hash, u.is_subscribed,
            CASE
              WHEN adv.id IS NOT NULL THEN 'advertiser'
              WHEN pub.id IS NOT NULL THEN 'publisher'
              ELSE 'user'
            END AS role
     FROM users u
     LEFT JOIN advertisers adv ON adv.user_id = u.id
     LEFT JOIN publishers  pub ON pub.user_id  = u.id
     WHERE u.email = $1`,
    [email]
  );

  if (result.rows.length === 0) {
    const err = new Error('E-Mail oder Passwort falsch');
    err.status = 401;
    throw err;
  }

  const user = result.rows[0];
  const valid = await verifyPassword(password, user.password_hash);

  if (!valid) {
    const err = new Error('E-Mail oder Passwort falsch');
    err.status = 401;
    throw err;
  }

  const tokenPayload = { id: user.id, email: user.email, role: user.role };

  return {
    user: { id: user.id, email: user.email, role: user.role, isSubscribed: user.is_subscribed },
    accessToken:  signAccessToken(tokenPayload),
    refreshToken: signRefreshToken({ id: user.id }),
  };
}

// ── Token-Refresh ─────────────────────────────────────────────────────────────
export async function refreshTokens(refreshToken) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    const err = new Error('Refresh Token ungültig oder abgelaufen');
    err.status = 401;
    throw err;
  }

  const result = await pool.query(
    'SELECT id, email, is_subscribed FROM users WHERE id = $1',
    [payload.id]
  );

  if (result.rows.length === 0) {
    const err = new Error('User nicht gefunden');
    err.status = 401;
    throw err;
  }

  const user = result.rows[0];
  const tokenPayload = { id: user.id, email: user.email, role: 'user' };

  return {
    accessToken:  signAccessToken(tokenPayload),
    refreshToken: signRefreshToken({ id: user.id }),
  };
}
