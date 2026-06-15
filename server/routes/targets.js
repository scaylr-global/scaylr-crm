import { Router } from 'express';
import { q, q1, run, logActivity, today } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/targets — per-member target + today's call count
router.get('/', async (req, res, next) => {
  try {
    const t = today();
    const members = await q(
      'SELECT id, name, role, avatar_initials, avatar_color FROM users ORDER BY id'
    );
    const result = [];
    for (const m of members) {
      const target = await q1('SELECT daily_target FROM call_targets WHERE user_id = $1 AND date = $2::date', [m.id, t]);
      const { c } = await q1(
        `SELECT COUNT(*)::int AS c FROM call_logs WHERE logged_by = $1 AND created_at::date = $2::date`,
        [m.id, t]
      );
      result.push({ ...m, daily_target: target?.daily_target ?? 0, calls_today: c });
    }
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// POST /api/targets — set today's target for a user (admin/manager)
router.post('/', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const { user_id, daily_target } = req.body || {};
    if (!user_id || daily_target == null || daily_target < 0) {
      return res.status(400).json({ error: 'User and a non-negative target are required' });
    }
    const t = today();
    await run(
      `INSERT INTO call_targets (user_id, daily_target, date) VALUES ($1, $2, $3::date)
       ON CONFLICT (user_id, date) DO UPDATE SET daily_target = EXCLUDED.daily_target`,
      [user_id, daily_target, t]
    );

    const u = await q1('SELECT name FROM users WHERE id = $1', [user_id]);
    await logActivity({
      userId: req.user.id,
      actionType: 'target_set',
      description: `${req.user.name} set ${u?.name}'s daily target to ${daily_target}`,
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
