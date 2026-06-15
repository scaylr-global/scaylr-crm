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
