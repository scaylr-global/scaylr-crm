import { Router } from 'express';
import { q, q1, run, logActivity } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const VALID_OUTCOMES = ['Interested', 'Converted', 'Callback', 'No Answer', 'Not Interested', 'Wrong Number'];

async function withLogger(call) {
  if (call && call.logged_by) {
    call.logger = await q1(
      'SELECT id, name, avatar_initials, avatar_color FROM users WHERE id = $1',
      [call.logged_by]
    );
  }
  return call;
}

// GET /api/calls?lead_id=  (or recent across all leads, with limit)
router.get('/', async (req, res, next) => {
  try {
    const { lead_id, limit } = req.query;
    if (lead_id) {
      const rows = await q(
        'SELECT * FROM call_logs WHERE lead_id = $1 ORDER BY created_at DESC, id DESC',
        [lead_id]
      );
      return res.json(await Promise.all(rows.map(withLogger)));
    }
    const rows = await q(
      `SELECT cl.*, l.name AS lead_name, l.company AS lead_company
       FROM call_logs cl JOIN leads l ON l.id = cl.lead_id
       ORDER BY cl.created_at DESC, cl.id DESC LIMIT $1`,
      [Number(limit) || 50]
    );
    res.json(await Promise.all(rows.map(withLogger)));
  } catch (e) {
    next(e);
  }
});

// POST /api/calls
router.post('/', async (req, res, next) => {
  try {
    const { lead_id, outcome, duration_seconds, notes } = req.body || {};
    if (!lead_id || !VALID_OUTCOMES.includes(outcome)) {
      return res.status(400).json({ error: 'Lead and a valid outcome are required' });
    }
    const lead = await q1('SELECT * FROM leads WHERE id = $1', [lead_id]);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const call = await q1(
      `INSERT INTO call_logs (lead_id, logged_by, outcome, duration_seconds, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [lead_id, req.user.id, outcome, Number(duration_seconds) || 0, notes || null]
    );

    await run('UPDATE leads SET last_contact_at = now() WHERE id = $1', [lead_id]);

    await logActivity({
      userId: req.user.id,
      actionType: 'call_logged',
      description: `${req.user.name} logged a call (${outcome}) for ${lead.name}`,
      leadId: lead_id,
    });

    res.status(201).json(await withLogger(call));
  } catch (e) {
    next(e);
  }
});

// DELETE /api/calls/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const call = await q1('SELECT * FROM call_logs WHERE id = $1', [req.params.id]);
    if (!call) return res.status(404).json({ error: 'Call not found' });
    await run('DELETE FROM call_logs WHERE id = $1', [call.id]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
