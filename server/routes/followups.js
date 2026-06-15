import { Router } from 'express';
import { q, q1, run, logActivity } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const SELECT = `
  SELECT f.*, l.name AS lead_name, l.company AS lead_company, l.status AS lead_status,
         u.name AS assignee_name, u.avatar_initials, u.avatar_color
  FROM follow_ups f
  JOIN leads l ON l.id = f.lead_id
  LEFT JOIN users u ON u.id = f.assigned_to
`;

// GET /api/followups?lead_id=&assignee=&status=
router.get('/', async (req, res, next) => {
  try {
    const { lead_id, assignee, status } = req.query;
    const clauses = [`f.status <> 'deleted'`];
    const params = [];
    const add = (val) => {
      params.push(val);
      return `$${params.length}`;
    };
    if (lead_id) clauses.push(`f.lead_id = ${add(Number(lead_id))}`);
    if (assignee && assignee !== 'all') clauses.push(`f.assigned_to = ${add(Number(assignee))}`);
    if (status && status !== 'all') clauses.push(`f.status = ${add(status)}`);
    const where = `WHERE ${clauses.join(' AND ')}`;
    const rows = await q(`${SELECT} ${where} ORDER BY f.scheduled_at ASC`, params);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// POST /api/followups
router.post('/', async (req, res, next) => {
  try {
    const { lead_id, scheduled_at, note, assigned_to } = req.body || {};
    if (!lead_id || !scheduled_at) {
      return res.status(400).json({ error: 'Lead and scheduled date/time are required' });
    }
    const lead = await q1('SELECT * FROM leads WHERE id = $1', [lead_id]);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const inserted = await q1(
      `INSERT INTO follow_ups (lead_id, assigned_to, scheduled_at, note, status)
       VALUES ($1,$2,$3,$4,'pending') RETURNING id`,
      [lead_id, assigned_to || lead.assigned_to || req.user.id, scheduled_at, note || null]
    );

    await logActivity({
      userId: req.user.id,
      actionType: 'followup_scheduled',
      description: `${req.user.name} scheduled a follow-up for ${lead.name}`,
      leadId: lead_id,
    });

    const row = await q1(`${SELECT} WHERE f.id = $1`, [inserted.id]);
    res.status(201).json(row);
  } catch (e) {
    next(e);
  }
});

// PATCH /api/followups/:id/done
router.patch('/:id/done', async (req, res, next) => {
  try {
    const fu = await q1('SELECT * FROM follow_ups WHERE id = $1', [req.params.id]);
    if (!fu) return res.status(404).json({ error: 'Follow-up not found' });
    await run(`UPDATE follow_ups SET status = 'done', completed_at = now() WHERE id = $1`, [fu.id]);
    const lead = await q1('SELECT name FROM leads WHERE id = $1', [fu.lead_id]);
    await logActivity({
      userId: req.user.id,
      actionType: 'followup_completed',
      description: `${req.user.name} completed a follow-up for ${lead?.name || 'a lead'}`,
      leadId: fu.lead_id,
    });
    res.json(await q1(`${SELECT} WHERE f.id = $1`, [fu.id]));
  } catch (e) {
    next(e);
  }
});

// DELETE /api/followups/:id  (soft delete)
router.delete('/:id', async (req, res, next) => {
  try {
    const fu = await q1('SELECT * FROM follow_ups WHERE id = $1', [req.params.id]);
    if (!fu) return res.status(404).json({ error: 'Follow-up not found' });
    await run(`UPDATE follow_ups SET status = 'deleted' WHERE id = $1`, [fu.id]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
