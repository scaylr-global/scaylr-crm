import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Two drivers, one Postgres dialect:
//  - Production: `pg` connecting to DATABASE_URL (e.g. a free Neon database)
//  - Local dev:  PGlite, an embedded in-process Postgres (no install needed),
//                persisted to server/db/pgdata so data survives restarts.
const USE_PG = !!process.env.DATABASE_URL;

let _query; // (text, params) => Promise<{ rows }>
let _execScript; // (sql) => Promise<void>  (multi-statement, no params)
let _tx; // (fn) => Promise<any>  where fn receives a query(text, params) fn

if (USE_PG) {
  const pgmod = await import('pg');
  const { Pool } = pgmod.default;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
  _query = (text, params = []) => pool.query(text, params);
  _execScript = async (sql) => {
    await pool.query(sql);
  };
  _tx = async (fn) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await fn((t, p = []) => client.query(t, p));
      await client.query('COMMIT');
      return r;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  };
  console.log('[db] Using PostgreSQL via DATABASE_URL');
} else {
  const { PGlite } = await import('@electric-sql/pglite');
  const dataDir = process.env.DB_PATH || path.join(__dirname, 'pgdata');
  fs.mkdirSync(dataDir, { recursive: true });
  const lite = new PGlite(dataDir);
  await lite.waitReady;
  _query = (text, params = []) => lite.query(text, params);
  _execScript = (sql) => lite.exec(sql);
  _tx = (fn) => lite.transaction((tx) => fn((t, p = []) => tx.query(t, p)));
  console.log('[db] Using embedded PGlite at', dataDir);
}

// Apply schema (idempotent — IF NOT EXISTS everywhere).
await _execScript(fs.readFileSync(SCHEMA_PATH, 'utf-8'));

// ---- Query helpers ----
export async function q(text, params = []) {
  const r = await _query(text, params);
  return r.rows;
}
export async function q1(text, params = []) {
  const r = await _query(text, params);
  return r.rows[0] || null;
}
export async function run(text, params = []) {
  return _query(text, params);
}
export const tx = _tx;

// Write an activity log entry.
export async function logActivity({ userId, actionType, description, leadId = null }) {
  await _query(
    `INSERT INTO activity_log (user_id, action_type, description, lead_id)
     VALUES ($1, $2, $3, $4)`,
    [userId ?? null, actionType, description, leadId]
  );
}

// Today's date as YYYY-MM-DD (local).
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export default { q, q1, run, tx, logActivity, today };
