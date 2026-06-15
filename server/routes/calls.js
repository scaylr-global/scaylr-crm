import { Router } from 'express';
import db, { logActivity } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const VALID_OUTCOMES = ['Interested', 'Converted', 'Callback', 'No Answer', 'Not Interested', 'Wrong Number'];

function withLogger(call) {
  if (call && call.logged_by) {
    call.logger = db
      .prepare('SELECT id, name, avatar_initials, avatar_color FROM users WHERE id = ?')
      .get(call.logged_by);
  }
  return call;
}

// GET /api/calls?lead_id=  (or all, with limit)
router.get('/', (req, res) => {
  const { lead_id, limit } = req.query;
  if (lead_id) {
    const rows = db
      .prepare('SELECT * FROM call_logs WHERE lead_id = ? ORDER BY created_at DESC, id DESC')
      .all(lead_id);
    return res.json(rows.map(withLogger));
  }
  const rows = db
    .prepare(
      `SELECT cl.*, l.name AS lead_name, l.company AS lead_company
       FROM call_logs cl JOIN leads l ON l.id = cl.lead_id
       ORDER BY cl.created_at DESC, cl.id DESC LIMIT ?`
    )
    .all(Number(limit) || 50);
  res.json(rows.map(withLogger));
});

// POST /api/calls
router.post('/', (req, res) => {
  const { lead_id, outcome, duration_seconds, notes } = req.body || {};
  if (!lead_id || !VALID_OUTCOMES.includes(outcome)) {
    return res.status(400).json({ error: 'Lead and a valid outcome are required' });
  }
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(lead_id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const info = db
    .prepare(
      `INSERT INTO call_logs (lead_id, logged_by, outcome, duration_seconds, notes)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(lead_id, req.user.id, outcome, Number(duration_seconds) || 0, notes || null);

  db.prepare("UPDATE leads SET last_contact_at = datetime('now') WHERE id = ?").run(lead_id);

  logActivity({
    userId: req.user.id,
    actionType: 'call_logged',
    description: `${req.user.name} logged a call (${outcome}) for ${lead.name}`,
    leadId: lead_id,
  });

  const call = db.prepare('SELECT * FROM call_logs WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(withLogger(call));
});

// DELETE /api/calls/:id
router.delete('/:id', (req, res) => {
  const call = db.prepare('SELECT * FROM call_logs WHERE id = ?').get(req.params.id);
  if (!call) return res.status(404).json({ error: 'Call not found' });
  db.prepare('DELETE FROM call_logs WHERE id = ?').run(call.id);
  res.json({ ok: true });
});

export default router;
