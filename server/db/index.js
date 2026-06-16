import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DB_PATH lets a host mount a persistent disk (e.g. /data/scaylr.db) so data
// survives restarts/redeploys. Defaults to a local file for dev.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'scaylr.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Make sure the directory for the DB file exists (mounted disks may be empty).
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Apply schema (idempotent — uses IF NOT EXISTS)
const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
db.exec(schema);

// Sales Intelligence Layer — alter existing tables to add new columns.
// SQLite doesn't support ALTER TABLE ADD COLUMN IF NOT EXISTS, so we
// catch the "duplicate column" error and continue.
const newColumns = [
  "ALTER TABLE call_logs ADD COLUMN type TEXT DEFAULT 'Phone Call'",
  'ALTER TABLE call_logs ADD COLUMN talking_points TEXT',
  'ALTER TABLE call_logs ADD COLUMN pain_points TEXT',
  'ALTER TABLE call_logs ADD COLUMN objections TEXT',
  'ALTER TABLE call_logs ADD COLUMN next_step TEXT',
  'ALTER TABLE leads ADD COLUMN value REAL',
  'ALTER TABLE leads ADD COLUMN is_hot INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE leads ADD COLUMN converted_package TEXT',
  'ALTER TABLE leads ADD COLUMN converted_mrr REAL',
  'ALTER TABLE leads ADD COLUMN lost_reason TEXT',
];
for (const sql of newColumns) {
  try {
    db.prepare(sql).run();
  } catch (e) {
    if (!e.message.includes('duplicate column')) throw e;
  }
}

// Recreate the leads_enriched view (DROP + CREATE is always idempotent)
db.exec(`
  DROP VIEW IF EXISTS leads_enriched;
  CREATE VIEW leads_enriched AS
  WITH last_call AS (
    SELECT lead_id, MAX(created_at) AS last_call_at
    FROM call_logs
    GROUP BY lead_id
  )
  SELECT
    l.*,
    COALESCE(lc.last_call_at, l.created_at) AS last_touch_at,
    CAST((julianday('now') - julianday(COALESCE(lc.last_call_at, l.created_at))) AS INTEGER) AS days_silent
  FROM leads l
  LEFT JOIN last_call lc ON lc.lead_id = l.id;
`);

export default db;

// Helper: write an activity log entry
export function logActivity({ userId, actionType, description, leadId = null }) {
  db.prepare(
    `INSERT INTO activity_log (user_id, action_type, description, lead_id)
     VALUES (?, ?, ?, ?)`
  ).run(userId ?? null, actionType, description, leadId);
}

// Helper: today's date as YYYY-MM-DD (local)
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}
