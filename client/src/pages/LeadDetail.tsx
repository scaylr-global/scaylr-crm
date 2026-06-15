import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Phone,
  Copy,
  MessageCircle,
  Plus,
  Trash2,
  Pencil,
  Check,
  CalendarClock,
} from 'lucide-react';
import { format } from 'date-fns';
import { api, Lead, CallLog, FollowUp, User } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { OUTCOMES } from '../lib/constants';
import { StatusBadge, OutcomeBadge, Pill, Avatar, Modal, Field, Empty } from '../components/ui';
import LeadForm, { LeadFormValues } from '../components/LeadForm';

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [lead, setLead] = useState<Lead | null>(null);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showEdit, setShowEdit] = useState(false);
  const [showCall, setShowCall] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  function loadAll() {
    api.get<Lead>(`/leads/${id}`).then(setLead);
    api.get<CallLog[]>(`/calls?lead_id=${id}`).then(setCalls);
    api.get<FollowUp[]>(`/followups?lead_id=${id}`).then(setFollowups);
  }

  useEffect(() => {
    loadAll();
    api.get<User[]>('/users').then(setUsers);
    // eslint-disable-next-line
  }, [id]);

  if (!lead) return <div className="text-muted">Loading…</div>;

  const canEdit =
    user?.role === 'admin' || user?.role === 'manager' || lead.assigned_to === user?.id;
  const canDelete = user?.role === 'admin' || user?.role === 'manager';

  async function saveEdit(v: LeadFormValues) {
    await api.put(`/leads/${id}`, v);
    toast('Lead updated');
    setShowEdit(false);
    loadAll();
  }

  async function deleteLead() {
    if (!confirm('Delete this lead? This cannot be undone.')) return;
    await api.del(`/leads/${id}`);
    toast('Lead deleted');
    navigate('/leads');
  }

  async function deleteCall(cid: number) {
    await api.del(`/calls/${cid}`);
    toast('Call deleted');
    loadAll();
  }

  async function markDone(fid: number) {
    await api.patch(`/followups/${fid}/done`);
    toast('Follow-up completed');
    loadAll();
  }

  const pendingFu = followups.filter((f) => f.status === 'pending').length;

  return (
    <div>
      <Link to="/leads" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-teal mb-4">
        <ArrowLeft size={16} /> Back to Leads
      </Link>

      {/* Header */}
      <div className="card p-5 mb-4 flex items-center gap-4">
        <Avatar
          initials={(lead.name[0] || '?').toUpperCase() + (lead.name.split(' ')[1]?.[0] || '')}
          color={lead.assignee?.avatar_color || '#14b8a6'}
          size={56}
        />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">{lead.name}</h1>
            <StatusBadge status={lead.status} />
            <Pill>{lead.industry}</Pill>
          </div>
          <div className="text-sm text-muted mt-1">
            {lead.role_title && `${lead.role_title} · `}
            {lead.company}
            {lead.assignee && ` · Assigned to ${lead.assignee.name}`}
          </div>
        </div>
        {canEdit && (
          <button onClick={() => setShowEdit(true)} className="btn btn-ghost">
            <Pencil size={15} /> Edit
          </button>
        )}
        {canDelete && (
          <button onClick={deleteLead} className="btn btn-danger">
            <Trash2 size={15} /> Delete
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Left: contact + AI */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-semibold mb-4">Contact Details</h2>
            <PhoneRow label="Contact No. 01" number={lead.phone1} color="#22c55e" />
            {lead.phone2 && <PhoneRow label="Contact No. 02" number={lead.phone2} color="#ef4444" />}
            <div className="flex items-center gap-2 text-sm text-muted mt-4">
              <Building2 size={15} /> {lead.company || '—'}
            </div>
            <div className="text-xs text-muted mt-4 space-y-1 border-t border-border pt-3">
              <div>Added {format(new Date(lead.created_at + 'Z'), 'MMM d, yyyy')}</div>
              <div>
                Last contact{' '}
                {lead.last_contact_at
                  ? format(new Date(lead.last_contact_at + 'Z'), 'MMM d, yyyy')
                  : 'never'}
              </div>
            </div>
          </div>
        </div>

        {/* Right: calls + followups */}
        <div className="col-span-2 space-y-4">
          {/* Call history */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                Call History
                <span className="text-xs bg-white/10 text-muted px-2 py-0.5 rounded-full">{calls.length}</span>
              </h2>
              <button onClick={() => setShowCall(true)} className="btn btn-teal py-1.5">
                <Plus size={15} /> Log Call
              </button>
            </div>
            {calls.length === 0 ? (
              <Empty>No calls logged for this lead yet.</Empty>
            ) : (
              <div className="space-y-2">
                {calls.map((c) => (
                  <div key={c.id} className="flex items-start gap-3 bg-white/5 rounded-lg px-3 py-2.5">
                    <OutcomeBadge outcome={c.outcome} />
                    <div className="flex-1 min-w-0">
                      {c.notes && <div className="text-sm">{c.notes}</div>}
                      <div className="text-xs text-muted mt-0.5">
                        {fmtDur(c.duration_seconds)} · {format(new Date(c.created_at + 'Z'), 'MMM d, yyyy · h:mm a')}
                        {c.logger?.name && ` · ${c.logger.name}`}
                      </div>
                    </div>
                    <button onClick={() => deleteCall(c.id)} className="text-muted hover:text-red-400">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Follow-ups */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                Follow-ups
                <span className="text-xs bg-white/10 text-muted px-2 py-0.5 rounded-full">{pendingFu} pending</span>
              </h2>
              <button onClick={() => setShowSchedule(true)} className="btn btn-teal py-1.5">
                <Plus size={15} /> Schedule
              </button>
            </div>
            {followups.length === 0 ? (
              <Empty>No follow-ups scheduled.</Empty>
            ) : (
              <div className="space-y-2">
                {followups.map((f) => {
                  const done = f.status === 'done';
                  return (
                    <div key={f.id} className="flex items-start gap-3 bg-white/5 rounded-lg px-3 py-2.5">
                      {done ? (
                        <Check size={16} className="text-teal mt-0.5" />
                      ) : (
                        <CalendarClock size={16} className="text-muted mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className={`text-sm ${done ? 'line-through text-muted' : ''}`}>{f.note}</div>
                        <div className="text-xs text-muted mt-0.5">
                          {format(new Date(f.scheduled_at + 'Z'), 'MMM d, yyyy · h:mm a')}
                          {done && f.completed_at && ' · completed'}
                        </div>
                      </div>
                      {!done && (
                        <button onClick={() => markDone(f.id)} className="text-xs text-teal hover:underline">
                          Done
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showEdit && (
        <Modal title="Edit Lead" onClose={() => setShowEdit(false)} wide>
          <LeadForm initial={lead} users={users} onSubmit={saveEdit} onCancel={() => setShowEdit(false)} />
        </Modal>
      )}
      {showCall && (
        <LogCallModal
          leadId={lead.id}
          onClose={() => setShowCall(false)}
          onDone={() => {
            setShowCall(false);
            loadAll();
          }}
        />
      )}
      {showSchedule && (
        <ScheduleModal
          leadId={lead.id}
          onClose={() => setShowSchedule(false)}
          onDone={() => {
            setShowSchedule(false);
            loadAll();
          }}
        />
      )}
    </div>
  );
}

function PhoneRow({ label, number, color }: { label: string; number: string | null; color: string }) {
  const toast = useToast();
  if (!number) return null;
  const wa = number.replace(/[+\s]/g, '');
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-2">
        <Phone size={15} style={{ color }} />
        <div>
          <div className="text-xs text-muted">{label}</div>
          <div className="text-sm">{number}</div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noreferrer"
          className="p-1.5 rounded-md hover:bg-white/10 text-green-400"
          title="WhatsApp"
        >
          <MessageCircle size={16} />
        </a>
        <button
          onClick={() => {
            navigator.clipboard.writeText(number);
            toast('Copied to clipboard');
          }}
          className="p-1.5 rounded-md hover:bg-white/10 text-muted"
          title="Copy"
        >
          <Copy size={16} />
        </button>
      </div>
    </div>
  );
}

function LogCallModal({ leadId, onClose, onDone }: { leadId: number; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [outcome, setOutcome] = useState('Interested');
  const [mins, setMins] = useState(0);
  const [secs, setSecs] = useState(0);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api.post('/calls', {
        lead_id: leadId,
        outcome,
        duration_seconds: mins * 60 + secs,
        notes,
      });
      toast('Call logged');
      onDone();
    } catch (e: any) {
      toast(e.message, 'error');
      setBusy(false);
    }
  }

  return (
    <Modal title="Log Call" onClose={onClose}>
      <Field label="Outcome">
        <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          {OUTCOMES.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </Field>
      <Field label="Duration">
        <div className="flex items-center gap-2">
          <input type="number" min={0} value={mins} onChange={(e) => setMins(Math.max(0, +e.target.value))} />
          <span className="text-muted text-sm">min</span>
          <input
            type="number"
            min={0}
            max={59}
            value={secs}
            onChange={(e) => setSecs(Math.min(59, Math.max(0, +e.target.value)))}
          />
          <span className="text-muted text-sm">sec</span>
        </div>
      </Field>
      <Field label="Notes">
        <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What happened on the call?" />
      </Field>

      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="btn btn-ghost">
          Cancel
        </button>
        <button onClick={save} disabled={busy} className="btn btn-teal">
          {busy ? 'Saving…' : 'Log Call'}
        </button>
      </div>
    </Modal>
  );
}

function ScheduleModal({ leadId, onClose, onDone }: { leadId: number; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('09:00');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!date || !time) return toast('Pick a date and time', 'error');
    setBusy(true);
    try {
      // Convert local wall-clock to UTC "YYYY-MM-DD HH:MM:SS" so the server's
      // datetime('now') (UTC) overdue comparison is consistent with display.
      const utc = new Date(`${date}T${time}:00`).toISOString().slice(0, 19).replace('T', ' ');
      await api.post('/followups', {
        lead_id: leadId,
        scheduled_at: utc,
        note,
      });
      toast('Follow-up scheduled');
      onDone();
    } catch (e: any) {
      toast(e.message, 'error');
      setBusy(false);
    }
  }

  return (
    <Modal title="Schedule Follow-up" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Time">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <Field label="Note">
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's the follow-up about?" />
      </Field>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="btn btn-ghost">
          Cancel
        </button>
        <button onClick={save} disabled={busy} className="btn btn-teal">
          {busy ? 'Saving…' : 'Schedule'}
        </button>
      </div>
    </Modal>
  );
}

function fmtDur(s: number) {
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}
