import pg from 'pg';

const { Pool } = pg;

// Railway stellt DATABASE_URL bereit; lokal werden einzelne Variablen genutzt
const connectionConfig = process.env.DATABASE_URL
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
    };

export const pool = new Pool({
  ...connectionConfig,
  max:      10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

pool.on('error', (err) => {
  console.error('[DB] Pool-Fehler:', err.message);
});

// Test-Verbindung beim Start
pool.query('SELECT 1').then(() => {
  console.log('[DB] Verbindung OK');
}).catch(err => {
  console.error('[DB] Verbindung fehlgeschlagen:', err.message);
});
