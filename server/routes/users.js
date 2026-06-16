import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db, { logActivity } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const COLORS = ['#14b8a6', '#8b5cf6', '#f59e0b', '#3b82f6', '#ec4899', '#10b981', '#ef4444', '#6366f1'];

function initialsFor(name) {
  const parts = String(name).trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'U';
}

// List all users (everyone can see the team)
router.get('/', (req, res) => {
  const users = db
    .prepare('SELECT id, name, email, role, avatar_initials, avatar_color, created_at FROM users ORDER BY id')
    .all();
  res.json(users);
});

// Create user — admin only
router.post('/', requireRole('admin'), (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password and role are required' });
  }
  if (!['admin', 'manager', 'employee'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) return res.status(409).json({ error: 'A user with that email already exists' });

  const color = COLORS[db.prepare('SELECT COUNT(*) c FROM users').get().c % COLORS.length];
  const info = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, role, avatar_initials, avatar_color)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(name.trim(), email.toLowerCase().trim(), bcrypt.hashSync(password, 10), role, initialsFor(name), color);

  logActivity({
    userId: req.user.id,
    actionType: 'user_added',
    description: `${req.user.name} added user ${name} (${role})`,
  });

  const user = db
    .prepare('SELECT id, name, email, role, avatar_initials, avatar_color, created_at FROM users WHERE id = ?')
    .get(info.lastInsertRowid);
  res.status(201).json(user);
});

export default router;
