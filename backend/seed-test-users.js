/**
 * seed-test-users.js
 * Legt drei Testaccounts an: Nutzer, Werbetreibender, Publisher.
 * Aufruf: node seed-test-users.js
 * Voraussetzung: .env muss geladen sein (DATABASE_URL oder DB_* Variablen)
 */

import bcrypt from 'bcrypt';
import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      }
    : {
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME     || 'localad',
        user:     process.env.DB_USER     || 'localad',
        password: process.env.DB_PASSWORD,
      }
);

const SALT_ROUNDS = 12;

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── 1. Endnutzer ──────────────────────────────────────────────────────────
    const userPw = await bcrypt.hash('Test1234!', SALT_ROUNDS);
    const userExists = await client.query("SELECT id FROM users WHERE email = 'nutzer@test.localad'");

    let userId;
    if (userExists.rows.length > 0) {
      userId = userExists.rows[0].id;
      await client.query(
        "UPDATE users SET password_hash = $1, is_subscribed = true, postal_code = '47051' WHERE id = $2",
        [userPw, userId]
      );
      console.log('✓ Nutzer-Account aktualisiert');
    } else {
      const res = await client.query(
        `INSERT INTO users (email, password_hash, is_subscribed, postal_code)
         VALUES ('nutzer@test.localad', $1, true, '47051')
         RETURNING id`,
        [userPw]
      );
      userId = res.rows[0].id;
      console.log('✓ Nutzer-Account angelegt');
    }

    // ── 2. Werbetreibender ────────────────────────────────────────────────────
    const advPw = await bcrypt.hash('Test1234!', SALT_ROUNDS);
    const advExists = await client.query("SELECT id FROM users WHERE email = 'werbetreibender@test.localad'");

    let advUserId;
    if (advExists.rows.length > 0) {
      advUserId = advExists.rows[0].id;
      await client.query(
        "UPDATE users SET password_hash = $1 WHERE id = $2",
        [advPw, advUserId]
      );
      console.log('✓ Werbetreibenden-Account aktualisiert');
    } else {
      const res = await client.query(
        `INSERT INTO users (email, password_hash)
         VALUES ('werbetreibender@test.localad', $1)
         RETURNING id`,
        [advPw]
      );
      advUserId = res.rows[0].id;

      // Advertiser-Eintrag
      const advEntryExists = await client.query(
        'SELECT id FROM advertisers WHERE user_id = $1', [advUserId]
      );
      if (advEntryExists.rows.length === 0) {
        await client.query(
          `INSERT INTO advertisers (user_id, company_name, contact_email, postal_code, plan, is_active)
           VALUES ($1, 'Bäckerei Müller (Test)', 'werbetreibender@test.localad', '47051', 'basic', true)`,
          [advUserId]
        );
      }
      console.log('✓ Werbetreibenden-Account angelegt');
    }

    // ── 3. Publisher ──────────────────────────────────────────────────────────
    const pubPw = await bcrypt.hash('Test1234!', SALT_ROUNDS);
    const pubExists = await client.query("SELECT id FROM users WHERE email = 'publisher@test.localad'");

    let pubUserId;
    if (pubExists.rows.length > 0) {
      pubUserId = pubExists.rows[0].id;
      await client.query(
        "UPDATE users SET password_hash = $1 WHERE id = $2",
        [pubPw, pubUserId]
      );
      console.log('✓ Publisher-Account aktualisiert');
    } else {
      const res = await client.query(
        `INSERT INTO users (email, password_hash)
         VALUES ('publisher@test.localad', $1)
         RETURNING id`,
        [pubPw]
      );
      pubUserId = res.rows[0].id;

      // Publisher-Eintrag
      const pubEntryExists = await client.query(
        'SELECT id FROM publishers WHERE user_id = $1', [pubUserId]
      );
      if (pubEntryExists.rows.length === 0) {
        await client.query(
          `INSERT INTO publishers (user_id, domain, contact_email, is_verified, verification_method)
           VALUES ($1, 'demo.localad.de', 'publisher@test.localad', true, 'dns')`,
          [pubUserId]
        );
      }
      console.log('✓ Publisher-Account angelegt');
    }

    await client.query('COMMIT');

    console.log('\n─────────────────────────────────────────');
    console.log('Test-Zugangsdaten (alle mit Passwort: Test1234!)');
    console.log('─────────────────────────────────────────');
    console.log('Endnutzer       nutzer@test.localad         → /onboarding');
    console.log('Werbetreibender werbetreibender@test.localad → /dashboard');
    console.log('Publisher       publisher@test.localad       → /publisher');
    console.log('─────────────────────────────────────────');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Fehler:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
