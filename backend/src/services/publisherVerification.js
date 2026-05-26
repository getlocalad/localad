import dns from 'node:dns/promises';
import { pool } from '../db/db.js';

// ── DNS-Verifizierung ─────────────────────────────────────────────────────────
// Erwartet TXT-Record: localad-verify=<token>
export async function verifyViaDns(domain, token) {
  try {
    const records = await dns.resolveTxt(domain);
    // records ist ein Array von Arrays: [['v=spf1 ...'], ['localad-verify=abc123']]
    const flat = records.flat();
    return flat.some(r => r === `localad-verify=${token}`);
  } catch (err) {
    // DNS-Fehler (NXDOMAIN, TIMEOUT, etc.) → nicht verifiziert
    console.warn(`[Verify] DNS-Lookup fehlgeschlagen für ${domain}:`, err.code);
    return false;
  }
}

// ── Meta-Tag-Verifizierung ────────────────────────────────────────────────────
// Erwartet: <meta name="localad-verify" content="<token>" />
export async function verifyViaMetaTag(domain, token) {
  const url = `https://${domain}`;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'LocalAd-Verify/1.0' },
      signal: AbortSignal.timeout(8_000),
      redirect: 'follow',
    });

    if (!response.ok) return false;

    const html = await response.text();
    // Regex sucht nach <meta name="localad-verify" content="TOKEN" /> (Attributreihenfolge egal)
    const pattern = new RegExp(
      `<meta[^>]+name=["']localad-verify["'][^>]+content=["']${escapeRegex(token)}["'][^>]*>`,
      'i'
    );
    const patternAlt = new RegExp(
      `<meta[^>]+content=["']${escapeRegex(token)}["'][^>]+name=["']localad-verify["'][^>]*>`,
      'i'
    );
    return pattern.test(html) || patternAlt.test(html);
  } catch (err) {
    console.warn(`[Verify] Meta-Tag-Fetch fehlgeschlagen für ${domain}:`, err.message);
    return false;
  }
}

// ── Verifizierung in DB persistieren ─────────────────────────────────────────
export async function markPublisherVerified(publisherId) {
  await pool.query(
    `UPDATE publishers
     SET is_verified = TRUE, verified_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [publisherId]
  );
}

// ── Token generieren ──────────────────────────────────────────────────────────
export function generateVerificationToken() {
  const rand = crypto.getRandomValues(new Uint8Array(18));
  return 'lav-' + Buffer.from(rand).toString('hex');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
