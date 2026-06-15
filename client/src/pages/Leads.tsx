import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, Search, Building2, Phone, Mail, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { api, Lead, User } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { can, INDUSTRIES, ALL_STATUSES } from '../lib/constants';
import { StatusBadge, Pill, Avatar, Modal, Empty, Field } from '../components/ui';
import LeadForm, { LeadFormValues } from '../components/LeadForm';

export default function Leads() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

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

  function load() {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (industry !== 'all') params.set('industry', industry);
    if (status !== 'all') params.set('status', status);
    if (assignee !== 'all') params.set('assignee', assignee);
    if (mine) params.set('mine', 'true');
    api.get<Lead[]>(`/leads?${params}`).then(setLeads);
  }

  useEffect(() => {
    api.get<User[]>('/users').then(setUsers);
  }, []);
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
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          Leads
          <span className="text-sm bg-white/10 text-muted px-2 py-0.5 rounded-full">{leads.length}</span>
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMine((m) => !m)}
            className={`btn ${mine ? 'btn-teal' : 'btn-ghost'}`}
          >
            <UserCheck size={16} /> My Leads
          </button>
          {can(user?.role, 'csvImport') && (
            <button onClick={() => setShowImport(true)} className="btn btn-ghost">
              <Upload size={16} /> Import CSV
            </button>
          )}
          <button onClick={() => setShowAdd(true)} className="btn btn-teal">
            <Plus size={16} /> Add Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="pl-9"
            placeholder="Search name, company, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="w-auto" value={industry} onChange={(e) => setIndustry(e.target.value)}>
          <option value="all">All Industries</option>
          {INDUSTRIES.map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>
        <select className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select className="w-auto" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="all">All Assignees</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {/* Bulk bar */}
      <div className="flex items-center gap-3 mb-4 text-sm">
        <label className="flex items-center gap-2 text-muted cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-teal" checked={allSelected} onChange={toggleAll} />
          Select all
        </label>
        {selected.size > 0 && canBulk && (
          <div className="flex items-center gap-2">
            <span className="text-teal">{selected.size} selected</span>
            <select className="w-auto" value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
              <option value="">Unassign</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <button onClick={bulkReassign} className="btn btn-teal py-1">
              Reassign
            </button>
          </div>
        )}
        {selected.size > 0 && !canBulk && <span className="text-xs text-muted">(Bulk reassign requires manager role)</span>}
      </div>

      {leads.length === 0 ? (
        <Empty>No leads match your filters.</Empty>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {leads.map((l) => (
            <div
              key={l.id}
              className="card p-4 hover:border-teal/40 cursor-pointer transition-colors relative"
              onClick={() => navigate(`/leads/${l.id}`)}
            >
              <input
                type="checkbox"
                className="absolute top-4 left-4 w-4 h-4 accent-teal"
                checked={selected.has(l.id)}
                onChange={() => toggle(l.id)}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex items-start justify-between mb-2 pl-7">
                <div>
                  <div className="font-semibold">{l.name}</div>
                  {l.role_title && <div className="text-xs text-muted">{l.role_title}</div>}
                </div>
                <StatusBadge status={l.status} />
              </div>
              <div className="space-y-1.5 text-sm text-muted">
                {l.company && (
                  <div className="flex items-center gap-2">
                    <Building2 size={14} /> {l.company}
                  </div>
                )}
                {l.phone1 && (
                  <div className="flex items-center gap-2">
                    <Phone size={14} /> {l.phone1}
                  </div>
                )}
                {l.phone2 && (
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="opacity-50" /> {l.phone2}
                  </div>
                )}
                {l.email && (
                  <div className="flex items-center gap-2 truncate">
                    <Mail size={14} /> {l.email}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <Pill>{l.industry}</Pill>
                <div className="flex items-center gap-2 text-xs text-muted">
                  {l.assignee ? (
                    <>
                      <Avatar initials={l.assignee.avatar_initials} color={l.assignee.avatar_color} size={20} />
                      <span>{l.assignee.name.split(' ')[0]}</span>
                    </>
                  ) : (
                    <span>Unassigned</span>
                  )}
                  · {format(new Date(l.created_at), 'MMM d')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <Modal title="Add Lead" onClose={() => setShowAdd(false)} wide>
          <LeadForm users={users} onSubmit={addLead} onCancel={() => setShowAdd(false)} submitLabel="Add Lead" />
        </Modal>
      )}

      {showImport && (
        <CsvImport
          users={users}
          onClose={() => setShowImport(false)}
          onDone={() => {
            setShowImport(false);
            load();
          }}
        />
      )}
    </div>
  );
}

// ---- CSV Import ----
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
      <p className="text-sm text-muted mb-3">
        Columns supported: <code className="text-teal">name, role_title, company, phone1, phone2, email, industry, status</code>.
        Only <code>name</code> is required.
      </p>
      <input ref={fileRef} type="file" accept=".csv" onChange={onFile} />
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}

      {rows.length > 0 && (
        <>
          <div className="mt-4 text-sm text-muted">Preview ({rows.length} rows):</div>
          <div className="mt-2 max-h-64 overflow-auto border border-border rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-white/5 sticky top-0">
                <tr>
                  {['name', 'company', 'phone1', 'email', 'industry', 'status'].map((h) => (
                    <th key={h} className="text-left px-3 py-2 text-muted font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t border-border">
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
            <button onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button onClick={confirmImport} className="btn btn-teal">
              Import {rows.length} Leads
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}
