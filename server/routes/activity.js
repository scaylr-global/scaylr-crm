import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Map filter category -> action types
const FILTERS = {
  lead: ['lead_added', 'status_changed', 'lead_deleted', 'lead_imported', 'lead_reassigned'],
  calls: ['call_logged'],
  followups: ['followup_scheduled', 'followup_completed'],
  team: ['target_set'],
  user: ['user_added'],
};

// GET /api/activity?filter=&from=&to=
router.get('/', (req, res) => {
  const { filter, from, to } = req.query;
  const clauses = [];
  const params = {};
  if (filter && filter !== 'all' && FILTERS[filter]) {
    const types = FILTERS[filter];
    clauses.push(`a.action_type IN (${types.map((_, i) => `@t${i}`).join(',')})`);
    types.forEach((t, i) => (params[`t${i}`] = t));
  }
  if (from) {
    clauses.push('date(a.created_at) >= @from');
    params.from = from;
  }
  if (to) {
    clauses.push('date(a.created_at) <= @to');
    params.to = to;
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT a.*, u.name AS user_name, u.avatar_initials, u.avatar_color, l.name AS lead_name
       FROM activity_log a
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN leads l ON l.id = a.lead_id
       ${where}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT 300`
    )
    .all(params);
  res.json(rows);
});

export default router;
