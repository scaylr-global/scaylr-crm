import { Router } from 'express';
import db, { logActivity } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Join lead info onto a follow-up row
const SELECT = `
  SELECT f.*, l.name AS lead_name, l.company AS lead_company, l.status AS lead_status,
         u.name AS assignee_name, u.avatar_initials, u.avatar_color
  FROM follow_ups f
  JOIN leads l ON l.id = f.lead_id
  LEFT JOIN users u ON u.id = f.assigned_to
`;

// GET /api/followups?lead_id=&assignee=&status=
router.get('/', (req, res) => {
  const { lead_id, assignee, status } = req.query;
  const clauses = ["f.status != 'deleted'"];
  const params = {};
  if (lead_id) {
    clauses.push('f.lead_id = @lead_id');
    params.lead_id = Number(lead_id);
  }
  if (assignee && assignee !== 'all') {
    clauses.push('f.assigned_to = @assignee');
    params.assignee = Number(assignee);
  }
  if (status && status !== 'all') {
    clauses.push('f.status = @status');
    params.status = status;
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`${SELECT} ${where} ORDER BY f.scheduled_at ASC`).all(params);
  res.json(rows);
});

// POST /api/followups
router.post('/', (req, res) => {
  const { lead_id, scheduled_at, note, assigned_to } = req.body || {};
  if (!lead_id || !scheduled_at) {
    return res.status(400).json({ error: 'Lead and scheduled date/time are required' });
  }
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(lead_id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const info = db
    .prepare(
      `INSERT INTO follow_ups (lead_id, assigned_to, scheduled_at, note, status)
       VALUES (?, ?, ?, ?, 'pending')`
    )
    .run(lead_id, assigned_to || lead.assigned_to || req.user.id, scheduled_at, note || null);

  logActivity({
    userId: req.user.id,
    actionType: 'followup_scheduled',
    description: `${req.user.name} scheduled a follow-up for ${lead.name}`,
    leadId: lead_id,
  });

  const row = db.prepare(`${SELECT} WHERE f.id = ?`).get(info.lastInsertRowid);
  res.status(201).json(row);
});

// PATCH /api/followups/:id/done
router.patch('/:id/done', (req, res) => {
  const fu = db.prepare('SELECT * FROM follow_ups WHERE id = ?').get(req.params.id);
  if (!fu) return res.status(404).json({ error: 'Follow-up not found' });
  db.prepare("UPDATE follow_ups SET status = 'done', completed_at = datetime('now') WHERE id = ?").run(fu.id);
  const lead = db.prepare('SELECT name FROM leads WHERE id = ?').get(fu.lead_id);
  logActivity({
    userId: req.user.id,
    actionType: 'followup_completed',
    description: `${req.user.name} completed a follow-up for ${lead?.name || 'a lead'}`,
    leadId: fu.lead_id,
  });
  res.json(db.prepare(`${SELECT} WHERE f.id = ?`).get(fu.id));
});

// DELETE /api/followups/:id  (soft delete)
router.delete('/:id', (req, res) => {
  const fu = db.prepare('SELECT * FROM follow_ups WHERE id = ?').get(req.params.id);
  if (!fu) return res.status(404).json({ error: 'Follow-up not found' });
  db.prepare("UPDATE follow_ups SET status = 'deleted' WHERE id = ?").run(fu.id);
  res.json({ ok: true });
});

export default router;
