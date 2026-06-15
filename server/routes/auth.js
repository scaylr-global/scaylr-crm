import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { q1, run } from '../db/index.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = await q1('SELECT * FROM users WHERE email = $1', [String(email).toLowerCase().trim()]);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar_initials: user.avatar_initials,
        avatar_color: user.avatar_color,
      },
    });
  } catch (e) {
    next(e);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Any logged-in user can change their own password.
router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    const user = await q1('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (!bcrypt.compareSync(current_password, user.password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    await run('UPDATE users SET password_hash = $1 WHERE id = $2', [bcrypt.hashSync(new_password, 10), user.id]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
