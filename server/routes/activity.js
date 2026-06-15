import { Router } from 'express';
import { q } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const FILTERS = {
  lead: ['lead_added', 'status_changed', 'lead_deleted', 'lead_imported', 'lead_reassigned'],
  calls: ['call_logged'],
  followups: ['followup_scheduled', 'followup_completed'],
  team: ['target_set'],
  user: ['user_added'],
};

// GET /api/activity?filter=&from=&to=
router.get('/', async (req, res, next) => {
  try {
    const { filter, from, to } = req.query;
    const clauses = [];
    const params = [];
    const add = (val) => {
      params.push(val);
      return `$${params.length}`;
    };
    if (filter && filter !== 'all' && FILTERS[filter]) {
      const placeholders = FILTERS[filter].map((t) => add(t));
      clauses.push(`a.action_type IN (${placeholders.join(',')})`);
    }
    if (from) clauses.push(`a.created_at::date >= ${add(from)}::date`);
    if (to) clauses.push(`a.created_at::date <= ${add(to)}::date`);
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await q(
      `SELECT a.*, u.name AS user_name, u.avatar_initials, u.avatar_color, l.name AS lead_name
       FROM activity_log a
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN leads l ON l.id = a.lead_id
       ${where}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT 300`,
      params
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

export default router;
