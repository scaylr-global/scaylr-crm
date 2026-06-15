import { Router } from 'express';
import { q, q1, today } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const totalLeads = (await q1('SELECT COUNT(*)::int AS c FROM leads')).c;
    const closedLeads = (await q1(`SELECT COUNT(*)::int AS c FROM leads WHERE status = 'Closed'`)).c;
    const totalCalls = (await q1('SELECT COUNT(*)::int AS c FROM call_logs')).c;
    const overdue = (
      await q1(`SELECT COUNT(*)::int AS c FROM follow_ups WHERE status = 'pending' AND scheduled_at < now()`)
    ).c;

    const conversionRate = totalLeads ? Math.round((closedLeads / totalLeads) * 1000) / 10 : 0;

    // Call outcome breakdown (all time)
    const outcomeRows = await q('SELECT outcome, COUNT(*)::int AS c FROM call_logs GROUP BY outcome');
    const outcomes = ['Interested', 'Converted', 'Callback', 'No Answer', 'Not Interested', 'Wrong Number'].map(
      (o) => ({ outcome: o, count: outcomeRows.find((r) => r.outcome === o)?.c || 0 })
    );

    // Team progress (today)
    const t = today();
    const membersRaw = await q('SELECT id, name, role, avatar_initials, avatar_color FROM users ORDER BY id');
    const team = [];
    for (const m of membersRaw) {
      const target = await q1('SELECT daily_target FROM call_targets WHERE user_id = $1 AND date = $2::date', [m.id, t]);
      const { c } = await q1(
        `SELECT COUNT(*)::int AS c FROM call_logs WHERE logged_by = $1 AND created_at::date = $2::date`,
        [m.id, t]
      );
      team.push({ ...m, daily_target: target?.daily_target ?? 0, calls_today: c });
    }

    // Overdue follow-ups (top 5)
    const overdueList = await q(
      `SELECT f.*, l.name AS lead_name, l.company AS lead_company
       FROM follow_ups f JOIN leads l ON l.id = f.lead_id
       WHERE f.status = 'pending' AND f.scheduled_at < now()
       ORDER BY f.scheduled_at ASC LIMIT 5`
    );

    // Recent calls (last 10)
    const recentCalls = await q(
      `SELECT cl.*, l.name AS lead_name, l.company AS lead_company, u.name AS logger_name
       FROM call_logs cl JOIN leads l ON l.id = cl.lead_id
       LEFT JOIN users u ON u.id = cl.logged_by
       ORDER BY cl.created_at DESC, cl.id DESC LIMIT 10`
    );

    res.json({
      stats: { totalLeads, conversionRate, totalCalls, overdue },
      outcomes,
      team,
      overdueList,
      recentCalls,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
