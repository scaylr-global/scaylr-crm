import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { q, q1, logActivity } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const COLORS = ['#14b8a6', '#8b5cf6', '#f59e0b', '#3b82f6', '#ec4899', '#10b981', '#ef4444', '#6366f1'];

function initialsFor(name) {
  const parts = String(name).trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'U';
}

// List all users
router.get('/', async (req, res, next) => {
  try {
    const users = await q(
      'SELECT id, name, email, role, avatar_initials, avatar_color, created_at FROM users ORDER BY id'
    );
    res.json(users);
  } catch (e) {
    next(e);
  }
});

// Create user — admin only
router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password and role are required' });
    }
    if (!['admin', 'manager', 'employee'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const existing = await q1('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing) return res.status(409).json({ error: 'A user with that email already exists' });

    const { c } = await q1('SELECT COUNT(*)::int AS c FROM users');
    const color = COLORS[c % COLORS.length];
    const user = await q1(
      `INSERT INTO users (name, email, password_hash, role, avatar_initials, avatar_color)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, avatar_initials, avatar_color, created_at`,
      [name.trim(), email.toLowerCase().trim(), bcrypt.hashSync(password, 10), role, initialsFor(name), color]
    );

    await logActivity({
      userId: req.user.id,
      actionType: 'user_added',
      description: `${req.user.name} added user ${name} (${role})`,
    });

    res.status(201).json(user);
  } catch (e) {
    next(e);
  }
});

export default router;
