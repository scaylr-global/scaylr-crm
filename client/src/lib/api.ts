import { sb } from './supabase';
import { computeScore, getTemperature, getWinPct } from './scoring';

// ── Session (stored in localStorage, no server JWT needed) ───────────────────
const USER_KEY = 'scaylr_user';

export function getToken(): string | null { return localStorage.getItem(USER_KEY); }
export function setToken(v: string) { localStorage.setItem(USER_KEY, v); }
export function clearToken() { localStorage.removeItem(USER_KEY); }
function storedUser(): User | null {
  const s = localStorage.getItem(USER_KEY);
  return s ? JSON.parse(s) : null;
}

export class ApiError extends Error {
  status: number;
  constructor(msg: string, status = 500) { super(msg); this.status = status; }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'employee';
  avatar_initials: string;
  avatar_color: string;
  created_at?: string;
}

export interface Lead {
  id: number;
  name: string;
  role_title: string | null;
  company: string | null;
  phone1: string | null;
  phone2: string | null;
  email: string | null;
  industry: string;
  status: string;
  assigned_to: number | null;
  assignee?: { id: number; name: string; avatar_initials: string; avatar_color: string } | null;
  created_at: string;
  last_contact_at: string | null;
  notes: string | null;
  value?: number | null;
  is_hot?: number;
  converted_package?: string | null;
  converted_mrr?: number | null;
  lost_reason?: string | null;
  last_touch_at?: string | null;
  days_silent?: number;
  score?: number;
  temperature?: 'Hot' | 'Warm' | 'Cold';
  win_pct?: number;
}

export interface CallLog {
  id: number;
  lead_id: number;
  logged_by: number;
  outcome: string;
  type?: string;
  duration_seconds: number;
  notes: string | null;
  talking_points?: string | null;
  pain_points?: string | null;
  objections?: string | null;
  next_step?: string | null;
  created_at: string;
  lead_name?: string;
  lead_company?: string;
  logger_name?: string;
  logger?: { name: string };
}

export interface CallPrep {
  lastInteraction: { date: string; outcome: string; type: string | null; notes: string | null } | null;
  talkingPoints: string | null;
  painPoints: string | null;
  objections: string | null;
  nextStep: string | null;
  totalCalls: number;
}

export interface Intel {
  allPainPoints: { text: string; date: string; type: string | null }[];
  allObjections: { text: string; date: string; type: string | null }[];
  allNextSteps: { text: string; date: string }[];
  outcomeHistory: { date: string; outcome: string; type: string | null }[];
}

export interface FollowUp {
  id: number;
  lead_id: number;
  assigned_to: number | null;
  scheduled_at: string;
  note: string | null;
  status: string;
  completed_at: string | null;
  created_at: string;
  lead_name?: string;
  lead_company?: string;
  lead_status?: string;
  assignee_name?: string;
}

export interface TargetRow {
  id: number;
  name: string;
  role: string;
  avatar_initials: string;
  avatar_color: string;
  daily_target: number;
  calls_today: number;
}

export interface Activity {
  id: number;
  user_id: number | null;
  action_type: string;
  description: string;
  lead_id: number | null;
  created_at: string;
  user_name?: string;
  avatar_initials?: string;
  avatar_color?: string;
  lead_name?: string;
}

// ── Lead enrichment (client-side scoring + days_silent) ──────────────────────

function enrichLead(row: any): Lead {
  const calls: any[] = row.call_logs ?? [];
  const sorted = [...calls].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const lastTouchAt: string = sorted[0]?.created_at ?? row.created_at;
  const daysSilent = Math.max(0, Math.floor(
    (Date.now() - new Date(lastTouchAt).getTime()) / 86_400_000
  ));
  const score = computeScore({ ...row, days_silent: daysSilent }, calls);
  const temperature = getTemperature(score, row.is_hot);
  const winPct = getWinPct(row.status);
  const { call_logs: _cl, ...rest } = row;
  return {
    ...rest,
    is_hot: row.is_hot ? 1 : 0,
    last_contact_at: null,
    last_touch_at: lastTouchAt,
    days_silent: daysSilent,
    score,
    temperature,
    win_pct: winPct,
  };
}

// Supabase select string for leads with enrichment data
const LEAD_SELECT = `
  *,
  assignee:users!leads_assigned_to_fkey(id, name, avatar_initials, avatar_color),
  call_logs(id, created_at, outcome, pain_points, objections, next_step, talking_points)
`;

// ── GET ───────────────────────────────────────────────────────────────────────

async function handleGet<T>(path: string): Promise<T> {
  const [pathname, qs] = path.split('?');
  const params = new URLSearchParams(qs ?? '');
  const segs = pathname.split('/').filter(Boolean);
  const [res, id, sub] = segs;

  // /auth/me
  if (res === 'auth' && id === 'me') return storedUser() as any;

  // /users
  if (res === 'users' && !id) {
    const { data, error } = await sb.from('users').select('*').order('name');
    if (error) throw new ApiError(error.message);
    return (data ?? []) as any;
  }

  // /leads  (list)
  if (res === 'leads' && !id) {
    let q = sb.from('leads').select(LEAD_SELECT).order('created_at', { ascending: false });
    const search = params.get('search');
    const status = params.get('status');
    const industry = params.get('industry');
    const assigneeP = params.get('assignee');
    const mine = params.get('mine');
    const me = storedUser();
    if (search) q = q.or(`name.ilike.%${search}%,company.ilike.%${search}%,phone1.ilike.%${search}%`);
    if (status) q = q.eq('status', status);
    if (industry) q = q.eq('industry', industry);
    if (assigneeP) q = q.eq('assigned_to', assigneeP);
    if (mine === 'true' && me) q = q.eq('assigned_to', me.id);
    const { data, error } = await q;
    if (error) throw new ApiError(error.message);
    return ((data ?? []).map(enrichLead)) as any;
  }

  // /leads/stale
  if (res === 'leads' && id === 'stale') {
    const minDays = Number(params.get('min_days') ?? 7);
    const limit = Number(params.get('limit') ?? 20);
    const { data, error } = await sb.from('leads').select(LEAD_SELECT)
      .not('status', 'in', '("Closed","Lost")')
      .order('created_at', { ascending: true })
      .limit(100);
    if (error) throw new ApiError(error.message);
    return ((data ?? []).map(enrichLead)
      .filter(l => (l.days_silent ?? 0) >= minDays)
      .sort((a, b) => (b.days_silent ?? 0) - (a.days_silent ?? 0))
      .slice(0, limit)) as any;
  }

  // /leads/:id/call-prep
  if (res === 'leads' && id && sub === 'call-prep') {
    const { data: calls } = await sb.from('call_logs').select('*')
      .eq('lead_id', id).order('created_at', { ascending: false });
    const c = calls ?? [];
    if (c.length === 0) return { lastInteraction: null, talkingPoints: null, painPoints: null, objections: null, nextStep: null, totalCalls: 0 } as any;
    const last = c[0];
    return {
      lastInteraction: { date: last.created_at, outcome: last.outcome, type: last.type ?? null, notes: last.notes ?? null },
      talkingPoints: c.find(x => x.talking_points)?.talking_points ?? null,
      painPoints: c.find(x => x.pain_points)?.pain_points ?? null,
      objections: c.find(x => x.objections)?.objections ?? null,
      nextStep: last.next_step ?? c.find(x => x.next_step)?.next_step ?? null,
      totalCalls: c.length,
    } as any;
  }

  // /leads/:id/intel
  if (res === 'leads' && id && sub === 'intel') {
    const { data: calls } = await sb.from('call_logs').select('*')
      .eq('lead_id', id).order('created_at', { ascending: false });
    const c = calls ?? [];
    return {
      allPainPoints: c.filter(x => x.pain_points).map(x => ({ text: x.pain_points, date: x.created_at, type: x.type ?? null })),
      allObjections: c.filter(x => x.objections).map(x => ({ text: x.objections, date: x.created_at, type: x.type ?? null })),
      allNextSteps: c.filter(x => x.next_step).map(x => ({ text: x.next_step, date: x.created_at })),
      outcomeHistory: c.map(x => ({ date: x.created_at, outcome: x.outcome, type: x.type ?? null })),
    } as any;
  }

  // /leads/:id  (single)
  if (res === 'leads' && id && !sub) {
    const { data, error } = await sb.from('leads').select(LEAD_SELECT).eq('id', id).single();
    if (error) throw new ApiError('Lead not found', 404);
    return enrichLead(data) as any;
  }

  // /calls?lead_id=
  if (res === 'calls') {
    const leadId = params.get('lead_id');
    let q = sb.from('call_logs').select('*, logger:users!call_logs_logged_by_fkey(name)').order('created_at', { ascending: false });
    if (leadId) q = q.eq('lead_id', leadId);
    const { data, error } = await q;
    if (error) throw new ApiError(error.message);
    return ((data ?? []).map(c => ({ ...c, logger: c.logger ? { name: (c.logger as any).name } : null }))) as any;
  }

  // /followups
  if (res === 'followups') {
    const leadId = params.get('lead_id');
    const status = params.get('status');
    let q = sb.from('follow_ups').select('*, lead:leads(name, company, status)').order('scheduled_at');
    if (leadId) q = q.eq('lead_id', leadId);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw new ApiError(error.message);
    return ((data ?? []).map(f => ({
      ...f,
      assigned_to: (f as any).created_by ?? null,
      completed_at: null,
      lead_name: (f.lead as any)?.name ?? null,
      lead_company: (f.lead as any)?.company ?? null,
      lead_status: (f.lead as any)?.status ?? null,
    }))) as any;
  }

  // /targets
  if (res === 'targets') {
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: users }, { data: tgts }, { data: todayCalls }] = await Promise.all([
      sb.from('users').select('*').order('name'),
      sb.from('targets').select('*'),
      sb.from('call_logs').select('logged_by')
        .gte('created_at', today + 'T00:00:00.000Z')
        .lte('created_at', today + 'T23:59:59.999Z'),
    ]);
    return ((users ?? []).map(u => ({
      id: u.id, name: u.name, role: u.role,
      avatar_initials: u.avatar_initials, avatar_color: u.avatar_color,
      daily_target: (tgts ?? []).find((t: any) => t.user_id === u.id)?.daily_target ?? 10,
      calls_today: (todayCalls ?? []).filter((c: any) => c.logged_by === u.id).length,
    }))) as any;
  }

  // /dashboard
  if (res === 'dashboard') {
    const today = new Date().toISOString().slice(0, 10);
    const [
      { data: leads },
      { data: recentCalls },
      { data: overdue },
    ] = await Promise.all([
      sb.from('leads').select('id, status, value, assigned_to, created_at, call_logs(created_at)'),
      sb.from('call_logs').select('id, outcome, created_at, notes, lead:leads(name), logger:users!call_logs_logged_by_fkey(name)').order('created_at', { ascending: false }).limit(10),
      sb.from('follow_ups').select('id, scheduled_at, note, lead:leads(id, name, status)').eq('status', 'pending').lte('scheduled_at', new Date().toISOString()).order('scheduled_at').limit(5),
    ]);

    const total = leads?.length ?? 0;
    const active = (leads ?? []).filter(l => l.status !== 'Closed' && l.status !== 'Lost').length;
    const won = (leads ?? []).filter(l => l.status === 'Closed').length;
    const callsToday = (recentCalls ?? []).filter(c => c.created_at.startsWith(today)).length;

    const outcomeCounts: Record<string, number> = {};
    (recentCalls ?? []).forEach(c => { outcomeCounts[c.outcome] = (outcomeCounts[c.outcome] ?? 0) + 1; });
    const outcomes = Object.entries(outcomeCounts).map(([name, value]) => ({ name, value }));

    // Stale leads (computed from embedded call_logs)
    const enriched = ((leads ?? []) as any[]).map(l => {
      const calls = l.call_logs ?? [];
      const last = [...calls].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      const lastTouchAt = last?.created_at ?? l.created_at;
      const daysSilent = Math.max(0, Math.floor((Date.now() - new Date(lastTouchAt).getTime()) / 86_400_000));
      return { ...l, days_silent: daysSilent };
    });
    const staleLeads = enriched
      .filter(l => l.status !== 'Closed' && l.status !== 'Lost' && l.days_silent >= 7)
      .sort((a: any, b: any) => b.days_silent - a.days_silent)
      .slice(0, 5);

    return {
      stats: { total, active, won, callsToday },
      outcomes,
      team: [],
      overdueList: (overdue ?? []).map(f => ({ ...f, lead_name: (f.lead as any)?.name, lead_status: (f.lead as any)?.status })),
      recentCalls: (recentCalls ?? []).map(c => ({ ...c, lead_name: (c.lead as any)?.name, logger_name: (c.logger as any)?.name })),
      staleLeads,
    } as any;
  }

  // /activity
  if (res === 'activity') {
    const { data, error } = await sb.from('call_logs').select(
      'id, created_at, outcome, notes, lead:leads(id, name), logger:users!call_logs_logged_by_fkey(name, avatar_initials, avatar_color)'
    ).order('created_at', { ascending: false }).limit(100);
    if (error) throw new ApiError(error.message);
    return ((data ?? []).map(c => ({
      id: c.id, created_at: c.created_at, action_type: 'call',
      description: `${c.outcome}${c.notes ? ' — ' + (c.notes as string).slice(0, 60) : ''}`,
      lead_id: (c.lead as any)?.id ?? null,
      lead_name: (c.lead as any)?.name ?? null,
      user_name: (c.logger as any)?.name ?? null,
      avatar_initials: (c.logger as any)?.avatar_initials ?? null,
      avatar_color: (c.logger as any)?.avatar_color ?? null,
    }))) as any;
  }

  throw new ApiError(`Unknown path: ${path}`, 404);
}

// ── POST ──────────────────────────────────────────────────────────────────────

async function handlePost<T>(path: string, body: any = {}): Promise<T> {
  const segs = path.split('/').filter(Boolean);
  const [res, id, sub] = segs;

  // /auth/login
  if (res === 'auth' && id === 'login') {
    const { data, error } = await sb.from('users').select('*')
      .eq('email', (body.email ?? '').trim().toLowerCase())
      .eq('password', body.password ?? '')
      .single();
    if (error || !data) throw new ApiError('Invalid email or password', 401);
    setToken(JSON.stringify(data));
    return { token: 'session', user: data } as any;
  }

  // /leads
  if (res === 'leads' && !id) {
    const me = storedUser();
    const { data, error } = await sb.from('leads').insert({
      name: body.name, role_title: body.role_title || null, company: body.company || null,
      phone1: body.phone1 || null, phone2: body.phone2 || null, email: body.email || null,
      industry: body.industry || 'Other', status: body.status || 'New',
      assigned_to: body.assigned_to ? Number(body.assigned_to) : null,
      value: body.value ? Number(body.value) : null,
      created_by: me?.id ?? null,
    }).select().single();
    if (error) throw new ApiError(error.message);
    return data as any;
  }

  // /leads/bulk-reassign
  if (res === 'leads' && id === 'bulk-reassign') {
    const { error } = await sb.from('leads')
      .update({ assigned_to: body.assigned_to ? Number(body.assigned_to) : null })
      .in('id', body.ids ?? []);
    if (error) throw new ApiError(error.message);
    return { ok: true } as any;
  }

  // /leads/import
  if (res === 'leads' && id === 'import') {
    const me = storedUser();
    const rows = (body.rows ?? []).map((r: any) => ({
      name: r.name, role_title: r.role_title || null, company: r.company || null,
      phone1: r.phone1 || null, email: r.email || null,
      industry: r.industry || 'Other', status: r.status || 'New',
      created_by: me?.id ?? null,
    }));
    const { data, error } = await sb.from('leads').insert(rows).select();
    if (error) throw new ApiError(error.message);
    return { count: data?.length ?? 0 } as any;
  }

  // /leads/:id/activities
  if (res === 'leads' && id && sub === 'activities') {
    const me = storedUser();
    const { follow_up, ...callData } = body;
    const { error: callErr } = await sb.from('call_logs').insert({
      lead_id: Number(id), logged_by: me?.id ?? null,
      outcome: callData.outcome ?? 'Interested',
      duration_seconds: callData.duration_seconds ?? 0,
      notes: callData.notes || null, type: callData.type || 'Phone Call',
      talking_points: callData.talking_points || null,
      pain_points: callData.pain_points || null,
      objections: callData.objections || null,
      next_step: callData.next_step || null,
    });
    if (callErr) throw new ApiError(callErr.message);
    if (follow_up) {
      const { date, time, note } = follow_up;
      if (date && time) {
        const scheduled_at = new Date(`${date}T${time}:00`).toISOString();
        await sb.from('follow_ups').insert({ lead_id: Number(id), created_by: me?.id ?? null, scheduled_at, note: note || null });
      }
    }
    return { ok: true } as any;
  }

  // /followups
  if (res === 'followups') {
    const me = storedUser();
    const scheduled_at = body.scheduled_at
      ? new Date(body.scheduled_at.replace(' ', 'T') + 'Z').toISOString()
      : new Date(`${body.date}T${body.time}:00`).toISOString();
    const { data, error } = await sb.from('follow_ups').insert({
      lead_id: Number(body.lead_id), created_by: me?.id ?? null,
      scheduled_at, note: body.note || null,
    }).select().single();
    if (error) throw new ApiError(error.message);
    return data as any;
  }

  // /users
  if (res === 'users' && !id) {
    const initials = (body.name ?? '').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
    const colors = ['#14b8a6','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#10b981'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const { data, error } = await sb.from('users').insert({
      name: body.name, email: (body.email ?? '').toLowerCase(),
      password: body.password ?? 'changeme',
      role: body.role ?? 'employee',
      avatar_initials: initials, avatar_color: color,
    }).select().single();
    if (error) throw new ApiError(error.message);
    return data as any;
  }

  // /targets
  if (res === 'targets') {
    const rows = body.targets ?? [];
    for (const row of rows) {
      await sb.from('targets').upsert({ user_id: row.user_id, daily_target: row.daily_target }, { onConflict: 'user_id' });
    }
    return { ok: true } as any;
  }

  // /ai/improve-note — disabled (no server)
  if (res === 'ai') throw new ApiError('AI feature requires server — not available in this deployment', 503);

  throw new ApiError(`Unknown POST path: ${path}`, 404);
}

// ── PUT ───────────────────────────────────────────────────────────────────────

async function handlePut<T>(path: string, body: any = {}): Promise<T> {
  const segs = path.split('/').filter(Boolean);
  const [res, id] = segs;

  // /leads/:id
  if (res === 'leads' && id) {
    const { error } = await sb.from('leads').update({
      name: body.name, role_title: body.role_title || null, company: body.company || null,
      phone1: body.phone1 || null, phone2: body.phone2 || null, email: body.email || null,
      industry: body.industry || 'Other', status: body.status,
      assigned_to: body.assigned_to ? Number(body.assigned_to) : null,
      value: body.value ? Number(body.value) : null,
    }).eq('id', id);
    if (error) throw new ApiError(error.message);
    return handleGet<T>(`/leads/${id}`);
  }

  // /users/:id
  if (res === 'users' && id) {
    const { error } = await sb.from('users').update({
      name: body.name, email: (body.email ?? '').toLowerCase(),
      role: body.role, password: body.password,
    }).eq('id', id);
    if (error) throw new ApiError(error.message);
    return { ok: true } as any;
  }

  throw new ApiError(`Unknown PUT path: ${path}`, 404);
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

async function handlePatch<T>(path: string, body: any = {}): Promise<T> {
  const segs = path.split('/').filter(Boolean);
  const [res, id, sub] = segs;

  // /leads/:id/hot
  if (res === 'leads' && id && sub === 'hot') {
    const { data: current } = await sb.from('leads').select('is_hot').eq('id', id).single();
    const newVal = !current?.is_hot;
    const { error } = await sb.from('leads').update({ is_hot: newVal }).eq('id', id);
    if (error) throw new ApiError(error.message);
    return handleGet<T>(`/leads/${id}`);
  }

  // /leads/:id/convert
  if (res === 'leads' && id && sub === 'convert') {
    const { error } = await sb.from('leads').update({
      status: 'Closed', converted_package: body.package || null, converted_mrr: body.mrr || null,
    }).eq('id', id);
    if (error) throw new ApiError(error.message);
    return handleGet<T>(`/leads/${id}`);
  }

  // /leads/:id/lost
  if (res === 'leads' && id && sub === 'lost') {
    const { error } = await sb.from('leads').update({ status: 'Lost', lost_reason: body.reason || null }).eq('id', id);
    if (error) throw new ApiError(error.message);
    return handleGet<T>(`/leads/${id}`);
  }

  // /followups/:id/done
  if (res === 'followups' && id && sub === 'done') {
    const { error } = await sb.from('follow_ups').update({ status: 'done' }).eq('id', id);
    if (error) throw new ApiError(error.message);
    return { ok: true } as any;
  }

  // /auth/password
  if (res === 'auth' && id === 'password') {
    const me = storedUser();
    if (!me) throw new ApiError('Not logged in', 401);
    const { data: user } = await sb.from('users').select('*').eq('id', me.id).eq('password', body.currentPassword).single();
    if (!user) throw new ApiError('Current password is incorrect', 401);
    const { error } = await sb.from('users').update({ password: body.newPassword }).eq('id', me.id);
    if (error) throw new ApiError(error.message);
    return { ok: true } as any;
  }

  throw new ApiError(`Unknown PATCH path: ${path}`, 404);
}

// ── DELETE ────────────────────────────────────────────────────────────────────

async function handleDel<T>(path: string): Promise<T> {
  const segs = path.split('/').filter(Boolean);
  const [res, id] = segs;

  if (res === 'leads' && id) {
    const { error } = await sb.from('leads').delete().eq('id', id);
    if (error) throw new ApiError(error.message);
    return { ok: true } as any;
  }
  if (res === 'calls' && id) {
    const { error } = await sb.from('call_logs').delete().eq('id', id);
    if (error) throw new ApiError(error.message);
    return { ok: true } as any;
  }
  if (res === 'users' && id) {
    const { error } = await sb.from('users').delete().eq('id', id);
    if (error) throw new ApiError(error.message);
    return { ok: true } as any;
  }

  throw new ApiError(`Unknown DELETE path: ${path}`, 404);
}

// ── Public api object (same interface as before — pages don't change) ─────────

export const api = {
  get:   <T = any>(path: string)              => handleGet<T>(path),
  post:  <T = any>(path: string, body?: any)  => handlePost<T>(path, body ?? {}),
  put:   <T = any>(path: string, body?: any)  => handlePut<T>(path, body ?? {}),
  patch: <T = any>(path: string, body?: any)  => handlePatch<T>(path, body ?? {}),
  del:   <T = any>(path: string)              => handleDel<T>(path),
};
