import jwt from 'jsonwebtoken';
import { pool } from '../db/db.js';

export function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Nicht autorisiert' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token ungültig oder abgelaufen' });
  }
}

// Stellt sicher, dass der eingeloggte User ein Advertiser-Profil hat
export async function requireAdvertiserProfile(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT id FROM advertisers WHERE user_id = $1 AND is_active = true',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Kein aktives Werbetreibenden-Profil vorhanden' });
    }
    req.advertiser = result.rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

// Stellt sicher, dass der eingeloggte User ein Publisher-Profil hat
export async function requirePublisherProfile(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT id FROM publishers WHERE user_id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Kein Publisher-Profil vorhanden' });
    }
    req.publisher = result.rows[0];
    next();
  } catch (err) {
    next(err);
  }
}
