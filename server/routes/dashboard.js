import { Router } from 'express';
import db, { today } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const totalLeads = db.prepare('SELECT COUNT(*) c FROM leads').get().c;
  const closedLeads = db.prepare("SELECT COUNT(*) c FROM leads WHERE status = 'Closed'").get().c;
  const totalCalls = db.prepare('SELECT COUNT(*) c FROM call_logs').get().c;
  const overdue = db
    .prepare("SELECT COUNT(*) c FROM follow_ups WHERE status = 'pending' AND scheduled_at < datetime('now')")
    .get().c;

  const conversionRate = totalLeads ? Math.round((closedLeads / totalLeads) * 1000) / 10 : 0;

  // Call outcome breakdown (all time)
  const outcomeRows = db
    .prepare('SELECT outcome, COUNT(*) c FROM call_logs GROUP BY outcome')
    .all();
  const outcomes = ['Interested', 'Converted', 'Callback', 'No Answer', 'Not Interested', 'Wrong Number'].map(
    (o) => ({ outcome: o, count: outcomeRows.find((r) => r.outcome === o)?.c || 0 })
  );

  // Team progress (today)
  const t = today();
  const members = db
    .prepare("SELECT id, name, role, avatar_initials, avatar_color FROM users ORDER BY id")
    .all()
    .map((m) => ({
      ...m,
      daily_target: db.prepare('SELECT daily_target FROM call_targets WHERE user_id = ? AND date = ?').get(m.id, t)?.daily_target ?? 0,
      calls_today: db.prepare("SELECT COUNT(*) c FROM call_logs WHERE logged_by = ? AND date(created_at) = ?").get(m.id, t).c,
    }));

  // Overdue follow-ups (top 5)
  const overdueList = db
    .prepare(
      `SELECT f.*, l.name AS lead_name, l.company AS lead_company
       FROM follow_ups f JOIN leads l ON l.id = f.lead_id
       WHERE f.status = 'pending' AND f.scheduled_at < datetime('now')
       ORDER BY f.scheduled_at ASC LIMIT 5`
    )
    .all();

  // Recent calls (last 10)
  const recentCalls = db
    .prepare(
      `SELECT cl.*, l.name AS lead_name, l.company AS lead_company, u.name AS logger_name
       FROM call_logs cl JOIN leads l ON l.id = cl.lead_id
       LEFT JOIN users u ON u.id = cl.logged_by
       ORDER BY cl.created_at DESC, cl.id DESC LIMIT 10`
    )
    .all();

  res.json({
    stats: { totalLeads, conversionRate, totalCalls, overdue },
    outcomes,
    team: members,
    overdueList,
    recentCalls,
  });
});

export default router;
