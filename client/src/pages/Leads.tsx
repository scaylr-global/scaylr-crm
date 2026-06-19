import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Upload, Search, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { toDate } from '../lib/utils';
import { api, Lead, User } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { can, INDUSTRIES, ALL_STATUSES } from '../lib/constants';
import { StatusBadge, Pill, Avatar, Modal, Empty, Field, ScoreChip, DaysBadge } from '../components/ui';
import { Sheet } from '../components/sheet';
import LeadForm, { LeadFormValues } from '../components/LeadForm';
import LeadDetail from './LeadDetail';

export default function Leads() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('all');
  const [status, setStatus] = useState('all');
  const [assignee, setAssignee] = useState('all');
  const [mine, setMine] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [reassignTo, setReassignTo] = useState('');

  // Drawer state — driven by ?lead=:id query param for deep-link support
  const drawerLeadId = searchParams.get('lead') ? Number(searchParams.get('lead')) : null;

  function openDrawer(id: number) {
    setSearchParams({ lead: String(id) }, { replace: true });
  }
  function closeDrawer() {
    setSearchParams({}, { replace: true });
  }

  function load() {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (industry !== 'all') params.set('industry', industry);
    if (status !== 'all') params.set('status', status);
    if (assignee !== 'all') params.set('assignee', assignee);
    if (mine) params.set('mine', 'true');
    api.get<Lead[]>(`/leads?${params}`).then(setLeads);
  }

  useEffect(() => { api.get<User[]>('/users').then(setUsers); }, []);
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [search, industry, status, assignee, mine]);

  async function addLead(v: LeadFormValues) {
    await api.post('/leads', v);
    toast('Lead added');
    setShowAdd(false);
    load();
  }

  function toggle(id: number) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  const allSelected = leads.length > 0 && selected.size === leads.length;
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(leads.map((l) => l.id)));
  }

  async function bulkReassign() {
    if (!selected.size) return;
    await api.post('/leads/bulk-reassign', {
      ids: [...selected],
      assigned_to: reassignTo ? Number(reassignTo) : null,
    });
    toast(`Reassigned ${selected.size} lead(s)`);
    setSelected(new Set());
    setReassignTo('');
    load();
  }

  const canBulk = can(user?.role, 'bulkReassign');

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1 className="text-[24px] font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
          Leads
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/5 tabular" style={{ color: 'var(--text-muted)' }}>
            {leads.length}
          </span>
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMine((m) => !m)}
            className={`btn ${mine ? 'btn-primary' : 'btn-ghost'}`}
          >
            <UserCheck size={15} /> My Leads
          </button>
          {can(user?.role, 'csvImport') && (
            <button onClick={() => setShowImport(true)} className="btn btn-ghost">
              <Upload size={15} /> Import CSV
            </button>
          )}
          <button onClick={() => setShowAdd(true)} className="btn btn-primary">
            <Plus size={15} /> Add Lead
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
          <input className="pl-9 text-sm" placeholder="Search name, company, phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="w-auto text-sm" value={industry} onChange={(e) => setIndustry(e.target.value)}>
          <option value="all">All Industries</option>
          {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
        </select>
        <select className="w-auto text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          {ALL_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="w-auto text-sm" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="all">All Assignees</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      {/* ── Bulk bar ── */}
      {(canBulk || selected.size > 0) && (
        <div className="flex items-center gap-3 mb-3 text-sm">
          <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--text-muted)' }}>
            <input type="checkbox" className="w-4 h-4 accent-[#1FB8A6]" checked={allSelected} onChange={toggleAll} />
            Select all
          </label>
          {selected.size > 0 && canBulk && (
            <div className="flex items-center gap-2">
              <span style={{ color: 'var(--accent)' }}>{selected.size} selected</span>
              <select className="w-auto text-sm" value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
                <option value="">Unassign</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <button onClick={bulkReassign} className="btn btn-primary py-1">Reassign</button>
            </div>
          )}
          {selected.size > 0 && !canBulk && (
            <span className="text-xs" style={{ color: 'var(--text-faint)' }}>Bulk reassign requires manager role</span>
          )}
        </div>
      )}

      {/* ── Table ── */}
      {leads.length === 0 ? (
        <Empty>No leads match your filters.</Empty>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
                <th className="w-10 pl-4 py-3">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-[#1FB8A6]"
                    checked={allSelected}
                    onChange={toggleAll}
                    onClick={(e) => e.stopPropagation()}
                  />
                </th>
                <Th>Lead</Th>
                <Th>Company</Th>
                <Th>Phone</Th>
                <Th>Status</Th>
                <Th right>Score</Th>
                <Th right>Silent</Th>
                <Th>Assignee</Th>
                <Th right>Added</Th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l, i) => (
                <tr
                  key={l.id}
                  onClick={() => openDrawer(l.id)}
                  className="group cursor-pointer transition-colors duration-fast"
                  style={{
                    borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                    background: drawerLeadId === l.id ? 'var(--surface-2)' : undefined,
                  }}
                  onMouseEnter={(e) => {
                    if (drawerLeadId !== l.id)
                      (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
                  }}
                  onMouseLeave={(e) => {
                    if (drawerLeadId !== l.id)
                      (e.currentTarget as HTMLElement).style.background = '';
                  }}
                >
                  <td className="pl-4 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-[#1FB8A6]"
                      checked={selected.has(l.id)}
                      onChange={() => toggle(l.id)}
                    />
                  </td>
                  <td className="py-3 pr-4 min-w-[160px]">
                    <div className="font-medium text-sm leading-snug" style={{ color: 'var(--text)' }}>{l.name}</div>
                    {l.role_title && <div className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{l.role_title}</div>}
                  </td>
                  <td className="py-3 pr-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {l.company || <span style={{ color: 'var(--text-faint)' }}>—</span>}
                  </td>
                  <td className="py-3 pr-4 text-sm tabular whitespace-nowrap" style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {l.phone1 || <span style={{ color: 'var(--text-faint)' }}>—</span>}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={l.status} />
                  </td>
                  <td className="py-3 pr-4 text-right">
                    {l.score !== undefined ? (
                      <ScoreChip score={l.score} winPct={l.win_pct ?? 0} temperature={l.temperature} />
                    ) : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    {(l.days_silent ?? 0) >= 7
                      ? <DaysBadge days={l.days_silent!} />
                      : <span className="text-xs tabular" style={{ color: 'var(--text-faint)' }}>—</span>}
                  </td>
                  <td className="py-3 pr-4">
                    {l.assignee ? (
                      <div className="flex items-center gap-1.5">
                        <Avatar initials={l.assignee.avatar_initials} color={l.assignee.avatar_color} size={22} />
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{l.assignee.name.split(' ')[0]}</span>
                      </div>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-faint)' }}>—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right text-xs tabular whitespace-nowrap" style={{ color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>
                    {format(toDate(l.created_at), 'MMM d')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Lead detail drawer ── */}
      <Sheet
        open={drawerLeadId !== null}
        onClose={closeDrawer}
        label="Lead Details"
      >
        {drawerLeadId !== null && (
          <LeadDetail
            isDrawer
            drawerLeadId={drawerLeadId}
            onDrawerRefreshList={load}
          />
        )}
      </Sheet>

      {/* ── Modals ── */}
      {showAdd && (
        <Modal title="Add Lead" onClose={() => setShowAdd(false)} wide>
          <LeadForm users={users} onSubmit={addLead} onCancel={() => setShowAdd(false)} submitLabel="Add Lead" />
        </Modal>
      )}
      {showImport && (
        <CsvImport
          users={users}
          onClose={() => setShowImport(false)}
          onDone={() => { setShowImport(false); load(); }}
        />
      )}
    </div>
  );
}

// ── Table header cell ─────────────────────────────────────────────────────────
function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th
      className="py-3 pr-4 text-left"
      style={{
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--text-faint)',
        textAlign: right ? 'right' : 'left',
      }}
    >
      {children}
    </th>
  );
}

// ── CSV Import modal ──────────────────────────────────────────────────────────
function CsvImport({ users, onClose, onDone }: { users: User[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');

  function parse(text: string) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return setError('Empty file');
    const headers = splitCsv(lines[0]).map((h) => h.trim().toLowerCase());
    const out: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = splitCsv(lines[i]);
      const row: any = {};
      headers.forEach((h, idx) => (row[h] = (cells[idx] || '').trim()));
      if (row.name) out.push(row);
    }
    if (!out.length) return setError('No valid rows (need a "name" column)');
    setError('');
    setRows(out);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => parse(String(reader.result));
    reader.readAsText(f);
  }

  async function confirmImport() {
    const res = await api.post<{ count: number }>('/leads/import', { rows });
    toast(`Imported ${res.count} lead(s)`);
    onDone();
  }

  return (
    <Modal title="Import Leads from CSV" onClose={onClose} wide>
      <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
        Columns supported: <code className="text-sm" style={{ color: 'var(--accent)' }}>name, role_title, company, phone1, phone2, email, industry, status</code>.
        Only <code style={{ color: 'var(--accent)' }}>name</code> is required.
      </p>
      <input ref={fileRef} type="file" accept=".csv" onChange={onFile} />
      {error && <p className="text-sm mt-2" style={{ color: 'var(--danger)' }}>{error}</p>}
      {rows.length > 0 && (
        <>
          <div className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>Preview ({rows.length} rows):</div>
          <div className="mt-2 max-h-64 overflow-auto rounded-[var(--r-md)]" style={{ border: '1px solid var(--border)' }}>
            <table className="w-full text-xs">
              <thead style={{ background: 'var(--surface-2)', position: 'sticky', top: 0 }}>
                <tr>
                  {['name', 'company', 'phone1', 'email', 'industry', 'status'].map((h) => (
                    <th key={h} className="text-left px-3 py-2 label-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="px-3 py-1.5">{r.name}</td>
                    <td className="px-3 py-1.5">{r.company}</td>
                    <td className="px-3 py-1.5">{r.phone1}</td>
                    <td className="px-3 py-1.5">{r.email}</td>
                    <td className="px-3 py-1.5">{r.industry}</td>
                    <td className="px-3 py-1.5">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button onClick={confirmImport} className="btn btn-primary">Import {rows.length} Leads</button>
          </div>
        </>
      )}
    </Modal>
  );
}

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (c === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
