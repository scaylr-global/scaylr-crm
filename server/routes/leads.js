import { Router } from 'express';
import db, { logActivity } from '../db/index.js';
import { requireAuth, requireRole, canEditLead } from '../middleware/auth.js';
import { computeScore, getTemperature, getWinPct } from '../db/scoring.js';

const router = Router();
router.use(requireAuth);

const VALID_STATUS = ['New', 'Contacted', 'Call Again', 'Follow-up', 'Qualified', 'Closed', 'Lost'];
const VALID_INDUSTRY = ['Vehicle', 'Food', 'Service', 'Technology', 'Other'];
const VALID_OUTCOMES = ['Interested', 'Converted', 'Callback', 'No Answer', 'Not Interested', 'Wrong Number'];
const VALID_TYPES = ['Phone Call', 'WhatsApp', 'Meeting', 'Email', 'Note'];

function withAssignee(lead) {
  if (!lead) return lead;
  if (lead.assigned_to) {
    const u = db
      .prepare('SELECT id, name, avatar_initials, avatar_color FROM users WHERE id = ?')
      .get(lead.assigned_to);
    lead.assignee = u || null;
  } else {
    lead.assignee = null;
  }
  return lead;
}

function scoreLead(lead, calls) {
  const score = computeScore(lead, calls);
  return {
    ...lead,
    score,
    temperature: getTemperature(score, Boolean(lead.is_hot)),
    win_pct: getWinPct(lead.status),
  };
}

function enrichLeads(leads) {
  if (!leads.length) return leads;
  const ids = leads.map((l) => l.id);
  const placeholders = ids.map(() => '?').join(',');
  const allCalls = db
    .prepare(
      `SELECT lead_id, outcome, pain_points, objections, next_step
       FROM call_logs WHERE lead_id IN (${placeholders}) ORDER BY created_at DESC`
    )
    .all(ids);
  const callsByLead = {};
  for (const c of allCalls) {
    (callsByLead[c.lead_id] = callsByLead[c.lead_id] || []).push(c);
  }
  return leads.map((lead) => scoreLead(lead, callsByLead[lead.id] || []));
}

function enrichOne(lead) {
  if (!lead) return lead;
  const calls = db
    .prepare(
      'SELECT outcome, pain_points, objections, next_step FROM call_logs WHERE lead_id = ? ORDER BY created_at DESC'
    )
    .all(lead.id);
  return scoreLead(lead, calls);
}

// GET /api/leads — list with optional filters
router.get('/', (req, res) => {
  const { search, industry, status, assignee, mine } = req.query;
  const clauses = [];
  const params = {};
  if (search) {
    clauses.push('(name LIKE @s OR company LIKE @s OR phone1 LIKE @s OR phone2 LIKE @s)');
    params.s = `%${search}%`;
  }
  if (industry && industry !== 'all') {
    clauses.push('industry = @industry');
    params.industry = industry;
  }
  if (status && status !== 'all') {
    clauses.push('status = @status');
    params.status = status;
  }
  if (assignee && assignee !== 'all') {
    clauses.push('assigned_to = @assignee');
    params.assignee = Number(assignee);
  }
  if (mine === 'true') {
    clauses.push('assigned_to = @me');
    params.me = req.user.id;
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM leads_enriched ${where} ORDER BY created_at DESC, id DESC`)
    .all(params);
  res.json(enrichLeads(rows).map(withAssignee));
});

// GET /api/leads/stale — leads silent for >= min_days days (active only)
router.get('/stale', (req, res) => {
  const minDays = Number(req.query.min_days) || 7;
  const limit = Number(req.query.limit) || 20;
  const rows = db
    .prepare(
      `SELECT * FROM leads_enriched
       WHERE status NOT IN ('Closed','Lost') AND days_silent >= ?
       ORDER BY days_silent DESC, value DESC NULLS LAST
       LIMIT ?`
    )
    .all(minDays, limit);
  res.json(enrichLeads(rows).map(withAssignee));
});

// GET /api/leads/:id
router.get('/:id', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads_enriched WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  res.json(withAssignee(enrichOne(lead)));
});

// POST /api/leads
router.post('/', (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.phone1) {
    return res.status(400).json({ error: 'Name and Phone 1 are required' });
  }
  const status = VALID_STATUS.includes(b.status) ? b.status : 'New';
  const industry = VALID_INDUSTRY.includes(b.industry) ? b.industry : 'Other';
  const info = db
    .prepare(
      `INSERT INTO leads (name, role_title, company, phone1, phone2, email, industry, status, assigned_to, notes, value)
       VALUES (@name, @role_title, @company, @phone1, @phone2, @email, @industry, @status, @assigned_to, @notes, @value)`
    )
    .run({
      name: b.name.trim(),
      role_title: b.role_title || null,
      company: b.company || null,
      phone1: b.phone1,
      phone2: b.phone2 || null,
      email: b.email || null,
      industry,
      status,
      assigned_to: b.assigned_to || null,
      notes: b.notes || null,
      value: b.value ? Number(b.value) : null,
    });
  const lead = db.prepare('SELECT * FROM leads_enriched WHERE id = ?').get(info.lastInsertRowid);
  logActivity({
    userId: req.user.id,
    actionType: 'lead_added',
    description: `${req.user.name} added lead ${lead.name}`,
    leadId: lead.id,
  });
  res.status(201).json(withAssignee(enrichOne(lead)));
});

// PUT /api/leads/:id
router.put('/:id', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (!canEditLead(req.user, lead)) {
    return res.status(403).json({ error: 'You can only edit leads assigned to you' });
  }
  const b = req.body || {};
  const status = VALID_STATUS.includes(b.status) ? b.status : lead.status;
  const industry = VALID_INDUSTRY.includes(b.industry) ? b.industry : lead.industry;
  db.prepare(
    `UPDATE leads SET name=@name, role_title=@role_title, company=@company, phone1=@phone1,
       phone2=@phone2, email=@email, industry=@industry, status=@status, assigned_to=@assigned_to,
       notes=@notes, value=@value
     WHERE id=@id`
  ).run({
    id: lead.id,
    name: b.name ?? lead.name,
    role_title: b.role_title ?? lead.role_title,
    company: b.company ?? lead.company,
    phone1: b.phone1 ?? lead.phone1,
    phone2: b.phone2 ?? lead.phone2,
    email: b.email ?? lead.email,
    industry,
    status,
    assigned_to: b.assigned_to !== undefined ? b.assigned_to : lead.assigned_to,
    notes: b.notes ?? lead.notes,
    value: b.value !== undefined ? (b.value ? Number(b.value) : null) : lead.value,
  });
  if (status !== lead.status) {
    logActivity({
      userId: req.user.id,
      actionType: 'status_changed',
      description: `${req.user.name} moved ${lead.name} from ${lead.status} to ${status}`,
      leadId: lead.id,
    });
  }
  res.json(withAssignee(enrichOne(db.prepare('SELECT * FROM leads_enriched WHERE id = ?').get(lead.id))));
});

// PATCH /api/leads/:id/status — pipeline drag & drop
router.patch('/:id/status', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (!canEditLead(req.user, lead)) {
    return res.status(403).json({ error: 'You can only edit leads assigned to you' });
  }
  const { status } = req.body || {};
  if (!VALID_STATUS.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  if (status !== lead.status) {
    db.prepare('UPDATE leads SET status = ? WHERE id = ?').run(status, lead.id);
    logActivity({
      userId: req.user.id,
      actionType: 'status_changed',
      description: `${req.user.name} moved ${lead.name} from ${lead.status} to ${status}`,
      leadId: lead.id,
    });
  }
  res.json(withAssignee(enrichOne(db.prepare('SELECT * FROM leads_enriched WHERE id = ?').get(lead.id))));
});

// PATCH /api/leads/:id/hot — toggle is_hot flag
router.patch('/:id/hot', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (!canEditLead(req.user, lead)) return res.status(403).json({ error: 'Forbidden' });
  const newHot = lead.is_hot ? 0 : 1;
  db.prepare('UPDATE leads SET is_hot = ? WHERE id = ?').run(newHot, lead.id);
  logActivity({
    userId: req.user.id,
    actionType: 'hot_toggled',
    description: `${req.user.name} marked ${lead.name} as ${newHot ? 'Hot 🔥' : 'not hot'}`,
    leadId: lead.id,
  });
  res.json(withAssignee(enrichOne(db.prepare('SELECT * FROM leads_enriched WHERE id = ?').get(lead.id))));
});

// PATCH /api/leads/:id/convert — mark Closed with package details
router.patch('/:id/convert', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (!canEditLead(req.user, lead)) return res.status(403).json({ error: 'Forbidden' });
  const { package: pkg, mrr } = req.body || {};
  db.prepare(
    `UPDATE leads SET status='Closed', converted_package=@pkg, converted_mrr=@mrr WHERE id=@id`
  ).run({ id: lead.id, pkg: pkg || null, mrr: mrr ? Number(mrr) : null });
  logActivity({
    userId: req.user.id,
    actionType: 'lead_converted',
    description: `${req.user.name} converted ${lead.name}${pkg ? ` (${pkg})` : ''}`,
    leadId: lead.id,
  });
  res.json(withAssignee(enrichOne(db.prepare('SELECT * FROM leads_enriched WHERE id = ?').get(lead.id))));
});

// PATCH /api/leads/:id/lost — mark Lost with reason
router.patch('/:id/lost', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (!canEditLead(req.user, lead)) return res.status(403).json({ error: 'Forbidden' });
  const { reason } = req.body || {};
  db.prepare(
    `UPDATE leads SET status='Lost', lost_reason=@reason WHERE id=@id`
  ).run({ id: lead.id, reason: reason || null });
  logActivity({
    userId: req.user.id,
    actionType: 'lead_lost',
    description: `${req.user.name} marked ${lead.name} as Lost${reason ? `: ${reason}` : ''}`,
    leadId: lead.id,
  });
  res.json(withAssignee(enrichOne(db.prepare('SELECT * FROM leads_enriched WHERE id = ?').get(lead.id))));
});

// GET /api/leads/:id/call-prep — derive call prep panel from latest logs
router.get('/:id/call-prep', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const calls = db
    .prepare(
      'SELECT * FROM call_logs WHERE lead_id = ? ORDER BY created_at DESC LIMIT 10'
    )
    .all(lead.id);
  const last = calls[0] || null;
  // Pick the most recent non-null value for each field
  const pick = (field) => calls.find((c) => c[field]?.trim())?.[field] || null;
  res.json({
    lastInteraction: last
      ? { date: last.created_at, outcome: last.outcome, type: last.type, notes: last.notes }
      : null,
    talkingPoints: pick('talking_points'),
    painPoints: pick('pain_points'),
    objections: pick('objections'),
    nextStep: pick('next_step'),
    totalCalls: calls.length,
  });
});

// GET /api/leads/:id/intel — aggregated intelligence view
router.get('/:id/intel', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const calls = db
    .prepare('SELECT * FROM call_logs WHERE lead_id = ? ORDER BY created_at DESC')
    .all(lead.id);
  const allPainPoints = calls
    .filter((c) => c.pain_points?.trim())
    .map((c) => ({ text: c.pain_points.trim(), date: c.created_at, type: c.type }));
  const allObjections = calls
    .filter((c) => c.objections?.trim())
    .map((c) => ({ text: c.objections.trim(), date: c.created_at, type: c.type }));
  const allNextSteps = calls
    .filter((c) => c.next_step?.trim())
    .map((c) => ({ text: c.next_step.trim(), date: c.created_at }));
  const outcomeHistory = calls.map((c) => ({
    date: c.created_at,
    outcome: c.outcome,
    type: c.type,
  }));
  res.json({ allPainPoints, allObjections, allNextSteps, outcomeHistory });
});

// POST /api/leads/:id/activities — enriched log + optional follow-up
router.post('/:id/activities', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (!canEditLead(req.user, lead)) return res.status(403).json({ error: 'Forbidden' });
  const b = req.body || {};
  const outcome = VALID_OUTCOMES.includes(b.outcome) ? b.outcome : 'Interested';
  const type = VALID_TYPES.includes(b.type) ? b.type : 'Phone Call';
  let callId;
  db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO call_logs (lead_id, logged_by, outcome, type, duration_seconds, notes,
           talking_points, pain_points, objections, next_step)
         VALUES (@lead_id, @logged_by, @outcome, @type, @dur, @notes,
           @talking_points, @pain_points, @objections, @next_step)`
      )
      .run({
        lead_id: lead.id,
        logged_by: req.user.id,
        outcome,
        type,
        dur: Number(b.duration_seconds) || 0,
        notes: b.notes || null,
        talking_points: b.talking_points || null,
        pain_points: b.pain_points || null,
        objections: b.objections || null,
        next_step: b.next_step || null,
      });
    callId = info.lastInsertRowid;
    db.prepare("UPDATE leads SET last_contact_at = datetime('now') WHERE id = ?").run(lead.id);
    if (b.follow_up?.date && b.follow_up?.time) {
      const utc = new Date(`${b.follow_up.date}T${b.follow_up.time}:00`)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');
      db.prepare(
        `INSERT INTO follow_ups (lead_id, assigned_to, scheduled_at, note) VALUES (?, ?, ?, ?)`
      ).run(lead.id, req.user.id, utc, b.follow_up.note || null);
    }
  })();
  logActivity({
    userId: req.user.id,
    actionType: 'activity_logged',
    description: `${req.user.name} logged ${type} (${outcome}) for ${lead.name}`,
    leadId: lead.id,
  });
  const call = db.prepare('SELECT * FROM call_logs WHERE id = ?').get(callId);
  res.status(201).json(call);
});

// DELETE /api/leads/:id — admin/manager only
router.delete('/:id', requireRole('admin', 'manager'), (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  db.prepare('DELETE FROM leads WHERE id = ?').run(lead.id);
  logActivity({
    userId: req.user.id,
    actionType: 'lead_deleted',
    description: `${req.user.name} deleted lead ${lead.name}`,
  });
  res.json({ ok: true });
});

// POST /api/leads/bulk-reassign — admin/manager only
router.post('/bulk-reassign', requireRole('admin', 'manager'), (req, res) => {
  const { ids, assigned_to } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No leads selected' });
  }
  const stmt = db.prepare('UPDATE leads SET assigned_to = ? WHERE id = ?');
  const txn = db.transaction(() => {
    for (const id of ids) stmt.run(assigned_to || null, id);
  });
  txn();
  const who = assigned_to
    ? db.prepare('SELECT name FROM users WHERE id = ?').get(assigned_to)?.name || 'someone'
    : 'Unassigned';
  logActivity({
    userId: req.user.id,
    actionType: 'lead_reassigned',
    description: `${req.user.name} reassigned ${ids.length} lead(s) to ${who}`,
  });
  res.json({ ok: true, count: ids.length });
});

// POST /api/leads/import — admin/manager only
router.post('/import', requireRole('admin', 'manager'), (req, res) => {
  const { rows } = req.body || {};
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'No rows to import' });
  }
  const insert = db.prepare(
    `INSERT INTO leads (name, role_title, company, phone1, phone2, email, industry, status, assigned_to)
     VALUES (@name, @role_title, @company, @phone1, @phone2, @email, @industry, @status, @assigned_to)`
  );
  let count = 0;
  const txn = db.transaction(() => {
    for (const r of rows) {
      if (!r.name) continue;
      insert.run({
        name: String(r.name).trim(),
        role_title: r.role_title || null,
        company: r.company || null,
        phone1: r.phone1 || null,
        phone2: r.phone2 || null,
        email: r.email || null,
        industry: VALID_INDUSTRY.includes(r.industry) ? r.industry : 'Other',
        status: VALID_STATUS.includes(r.status) ? r.status : 'New',
        assigned_to: r.assigned_to || null,
      });
      count++;
    }
  });
  txn();
  logActivity({
    userId: req.user.id,
    actionType: 'lead_imported',
    description: `${req.user.name} imported ${count} lead(s) via CSV`,
  });
  res.json({ ok: true, count });
});

export default router;
