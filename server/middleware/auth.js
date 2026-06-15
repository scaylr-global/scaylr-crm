import jwt from 'jsonwebtoken';
import { q1 } from '../db/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Require a valid JWT. Attaches fresh user record to req.user.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  try {
    const user = await q1(
      'SELECT id, name, email, role, avatar_initials, avatar_color FROM users WHERE id = $1',
      [payload.id]
    );
    if (!user) return res.status(401).json({ error: 'User no longer exists' });
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

// Require one of the given roles.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Centralised permission matrix mirrored on the frontend.
export const PERMISSIONS = {
  viewAllLeads: ['admin', 'manager', 'employee'],
  editOwnLeads: ['admin', 'manager', 'employee'],
  editAnyLead: ['admin', 'manager'],
  deleteLeads: ['admin', 'manager'],
  logCalls: ['admin', 'manager', 'employee'],
  manageFollowUps: ['admin', 'manager', 'employee'],
  bulkReassign: ['admin', 'manager'],
  csvImport: ['admin', 'manager'],
  setCallTargets: ['admin', 'manager'],
  viewTeamTargets: ['admin', 'manager', 'employee'],
  manageUsers: ['admin'],
};

export function can(role, permission) {
  return (PERMISSIONS[permission] || []).includes(role);
}

// Can this user edit this specific lead?
export function canEditLead(user, lead) {
  if (user.role === 'admin' || user.role === 'manager') return true;
  return lead.assigned_to === user.id; // employee: only own leads
}
