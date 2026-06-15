import { Router } from 'express';
import { q, q1, run, tx, logActivity } from '../db/index.js';
import { requireAuth, requireRole, canEditLead } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const VALID_STATUS = ['New', 'Contacted', 'Call Again', 'Follow-up', 'Qualified', 'Closed', 'Lost'];
const VALID_INDUSTRY = ['Vehicle', 'Food', 'Service', 'Technology', 'Other'];

// Attach assignee object to a single lead.
async function withAssignee(lead) {
  if (!lead) return lead;
  if (lead.assigned_to) {
    lead.assignee = await q1(
      'SELECT id, name, avatar_initials, avatar_color FROM users WHERE id = $1',
      [lead.assigned_to]
    );
  } else {
    lead.assignee = null;
  }
  return lead;
}

// Batch-attach assignees to a list of leads (avoids N+1).
async function attachAssignees(leads) {
  const ids = [...new Set(leads.map((l) => l.assigned_to).filter(Boolean))];
  let map = {};
  if (ids.length) {
    const users = await q(
      `SELECT id, name, avatar_initials, avatar_color FROM users WHERE id = ANY($1::int[])`,
      [ids]
    );
    map = Object.fromEntries(users.map((u) => [u.id, u]));
  }
  for (const l of leads) l.assignee = l.assigned_to ? map[l.assigned_to] || null : null;
  return leads;
}

// GET /api/leads — list with optional filters
router.get('/', async (req, res, next) => {
  try {
    const { search, industry, status, assignee, mine } = req.query;
    const clauses = [];
    const params = [];
    const add = (val) => {
      params.push(val);
      return `$${params.length}`;
    };
    if (search) {
      const p = add(`%${search}%`);
      clauses.push(`(name ILIKE ${p} OR company ILIKE ${p} OR phone1 ILIKE ${p} OR phone2 ILIKE ${p})`);
    }
    if (industry && industry !== 'all') clauses.push(`industry = ${add(industry)}`);
    if (status && status !== 'all') clauses.push(`status = ${add(status)}`);
    if (assignee && assignee !== 'all') clauses.push(`assigned_to = ${add(Number(assignee))}`);
    if (mine === 'true') clauses.push(`assigned_to = ${add(req.user.id)}`);

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await q(`SELECT * FROM leads ${where} ORDER BY created_at DESC, id DESC`, params);
    res.json(await attachAssignees(rows));
  } catch (e) {
    next(e);
  }
});

// GET /api/leads/:id
router.get('/:id', async (req, res, next) => {
  try {
    const lead = await q1('SELECT * FROM leads WHERE id = $1', [req.params.id]);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(await withAssignee(lead));
  } catch (e) {
    next(e);
  }
});

// POST /api/leads
router.post('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.name || !b.phone1) {
      return res.status(400).json({ error: 'Name and Phone 1 are required' });
    }
    const status = VALID_STATUS.includes(b.status) ? b.status : 'New';
    const industry = VALID_INDUSTRY.includes(b.industry) ? b.industry : 'Other';
    const lead = await q1(
      `INSERT INTO leads (name, role_title, company, phone1, phone2, email, industry, status, assigned_to, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        b.name.trim(),
        b.role_title || null,
        b.company || null,
        b.phone1,
        b.phone2 || null,
        b.email || null,
        industry,
        status,
        b.assigned_to || null,
        b.notes || null,
      ]
    );
    await logActivity({
      userId: req.user.id,
      actionType: 'lead_added',
      description: `${req.user.name} added lead ${lead.name}`,
      leadId: lead.id,
    });
    res.status(201).json(await withAssignee(lead));
  } catch (e) {
    next(e);
  }
});

// PUT /api/leads/:id
router.put('/:id', async (req, res, next) => {
  try {
    const lead = await q1('SELECT * FROM leads WHERE id = $1', [req.params.id]);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (!canEditLead(req.user, lead)) {
      return res.status(403).json({ error: 'You can only edit leads assigned to you' });
    }
    const b = req.body || {};
    const status = VALID_STATUS.includes(b.status) ? b.status : lead.status;
    const industry = VALID_INDUSTRY.includes(b.industry) ? b.industry : lead.industry;
    await run(
      `UPDATE leads SET name=$1, role_title=$2, company=$3, phone1=$4, phone2=$5, email=$6,
         industry=$7, status=$8, assigned_to=$9, notes=$10 WHERE id=$11`,
      [
        b.name ?? lead.name,
        b.role_title ?? lead.role_title,
        b.company ?? lead.company,
        b.phone1 ?? lead.phone1,
        b.phone2 ?? lead.phone2,
        b.email ?? lead.email,
        industry,
        status,
        b.assigned_to !== undefined ? b.assigned_to : lead.assigned_to,
        b.notes ?? lead.notes,
        lead.id,
      ]
    );
    if (status !== lead.status) {
      await logActivity({
        userId: req.user.id,
        actionType: 'status_changed',
        description: `${req.user.name} moved ${lead.name} from ${lead.status} to ${status}`,
        leadId: lead.id,
      });
    }
    res.json(await withAssignee(await q1('SELECT * FROM leads WHERE id = $1', [lead.id])));
  } catch (e) {
    next(e);
  }
});

// PATCH /api/leads/:id/status — pipeline drag & drop
router.patch('/:id/status', async (req, res, next) => {
  try {
    const lead = await q1('SELECT * FROM leads WHERE id = $1', [req.params.id]);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (!canEditLead(req.user, lead)) {
      return res.status(403).json({ error: 'You can only edit leads assigned to you' });
    }
    const { status } = req.body || {};
    if (!VALID_STATUS.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    if (status !== lead.status) {
      await run('UPDATE leads SET status = $1 WHERE id = $2', [status, lead.id]);
      await logActivity({
        userId: req.user.id,
        actionType: 'status_changed',
        description: `${req.user.name} moved ${lead.name} from ${lead.status} to ${status}`,
        leadId: lead.id,
      });
    }
    res.json(await withAssignee(await q1('SELECT * FROM leads WHERE id = $1', [lead.id])));
  } catch (e) {
    next(e);
  }
});

// DELETE /api/leads/:id — admin/manager only
router.delete('/:id', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const lead = await q1('SELECT * FROM leads WHERE id = $1', [req.params.id]);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    await run('DELETE FROM leads WHERE id = $1', [lead.id]);
    await logActivity({
      userId: req.user.id,
      actionType: 'lead_deleted',
      description: `${req.user.name} deleted lead ${lead.name}`,
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// POST /api/leads/bulk-reassign — admin/manager only
router.post('/bulk-reassign', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const { ids, assigned_to } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No leads selected' });
    }
    await run('UPDATE leads SET assigned_to = $1 WHERE id = ANY($2::int[])', [
      assigned_to || null,
      ids.map(Number),
    ]);
    const who = assigned_to
      ? (await q1('SELECT name FROM users WHERE id = $1', [assigned_to]))?.name || 'someone'
      : 'Unassigned';
    await logActivity({
      userId: req.user.id,
      actionType: 'lead_reassigned',
      description: `${req.user.name} reassigned ${ids.length} lead(s) to ${who}`,
    });
    res.json({ ok: true, count: ids.length });
  } catch (e) {
    next(e);
  }
});

// POST /api/leads/import — admin/manager only
router.post('/import', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const { rows } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No rows to import' });
    }
    let count = 0;
    await tx(async (query) => {
      for (const r of rows) {
        if (!r.name) continue;
        await query(
          `INSERT INTO leads (name, role_title, company, phone1, phone2, email, industry, status, assigned_to)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            String(r.name).trim(),
            r.role_title || null,
            r.company || null,
            r.phone1 || null,
            r.phone2 || null,
            r.email || null,
            VALID_INDUSTRY.includes(r.industry) ? r.industry : 'Other',
            VALID_STATUS.includes(r.status) ? r.status : 'New',
            r.assigned_to || null,
          ]
        );
        count++;
      }
    });
    await logActivity({
      userId: req.user.id,
      actionType: 'lead_imported',
      description: `${req.user.name} imported ${count} lead(s) via CSV`,
    });
    res.json({ ok: true, count });
  } catch (e) {
    next(e);
  }
});

export default router;
