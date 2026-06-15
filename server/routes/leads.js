import { Router } from 'express';
import db, { logActivity } from '../db/index.js';
import { requireAuth, requireRole, canEditLead } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const VALID_STATUS = ['New', 'Contacted', 'Call Again', 'Follow-up', 'Qualified', 'Closed', 'Lost'];
const VALID_INDUSTRY = ['Vehicle', 'Food', 'Service', 'Technology', 'Other'];

// Attach assignee info to a lead row
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
  const rows = db.prepare(`SELECT * FROM leads ${where} ORDER BY created_at DESC, id DESC`).all(params);
  res.json(rows.map(withAssignee));
});

// GET /api/leads/:id
router.get('/:id', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  res.json(withAssignee(lead));
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
      `INSERT INTO leads (name, role_title, company, phone1, phone2, email, industry, status, assigned_to, notes)
       VALUES (@name, @role_title, @company, @phone1, @phone2, @email, @industry, @status, @assigned_to, @notes)`
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
    });
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(info.lastInsertRowid);
  logActivity({
    userId: req.user.id,
    actionType: 'lead_added',
    description: `${req.user.name} added lead ${lead.name}`,
    leadId: lead.id,
  });
  res.status(201).json(withAssignee(lead));
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
       phone2=@phone2, email=@email, industry=@industry, status=@status, assigned_to=@assigned_to, notes=@notes
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
  });
  if (status !== lead.status) {
    logActivity({
      userId: req.user.id,
      actionType: 'status_changed',
      description: `${req.user.name} moved ${lead.name} from ${lead.status} to ${status}`,
      leadId: lead.id,
    });
  }
  res.json(withAssignee(db.prepare('SELECT * FROM leads WHERE id = ?').get(lead.id)));
});

// PATCH /api/leads/:id/status — used by pipeline drag & drop
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
  res.json(withAssignee(db.prepare('SELECT * FROM leads WHERE id = ?').get(lead.id)));
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
