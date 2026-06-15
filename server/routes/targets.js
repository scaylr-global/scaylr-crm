import { Router } from 'express';
import db, { logActivity, today } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/targets — per-member target + today's call count
router.get('/', (req, res) => {
  const t = today();
  const members = db
    .prepare("SELECT id, name, role, avatar_initials, avatar_color FROM users ORDER BY id")
    .all();
  const result = members.map((m) => {
    const target = db
      .prepare('SELECT daily_target FROM call_targets WHERE user_id = ? AND date = ?')
      .get(m.id, t);
    const calls = db
      .prepare("SELECT COUNT(*) c FROM call_logs WHERE logged_by = ? AND date(created_at) = ?")
      .get(m.id, t).c;
    return {
      ...m,
      daily_target: target?.daily_target ?? 0,
      calls_today: calls,
    };
  });
  res.json(result);
});

// POST /api/targets — set today's target for a user (admin/manager)
router.post('/', requireRole('admin', 'manager'), (req, res) => {
  const { user_id, daily_target } = req.body || {};
  if (!user_id || daily_target == null || daily_target < 0) {
    return res.status(400).json({ error: 'User and a non-negative target are required' });
  }
  const t = today();
  db.prepare(
    `INSERT INTO call_targets (user_id, daily_target, date) VALUES (?, ?, ?)
     ON CONFLICT(user_id, date) DO UPDATE SET daily_target = excluded.daily_target`
  ).run(user_id, daily_target, t);

  const u = db.prepare('SELECT name FROM users WHERE id = ?').get(user_id);
  logActivity({
    userId: req.user.id,
    actionType: 'target_set',
    description: `${req.user.name} set ${u?.name}'s daily target to ${daily_target}`,
  });
  res.json({ ok: true });
});

export default router;
