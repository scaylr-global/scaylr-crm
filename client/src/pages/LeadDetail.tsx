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
  Sparkles,
  Loader2,
  ThumbsUp,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { api, Lead, CallLog, FollowUp, User } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { OUTCOMES } from '../lib/constants';
import { StatusBadge, OutcomeBadge, Pill, Avatar, Modal, Field, Empty } from '../components/ui';
import LeadForm, { LeadFormValues } from '../components/LeadForm';

// ── Types ──────────────────────────────────────────────────────────────────
interface AiInsights {
  score: 'Hot' | 'Warm' | 'Cold';
  summary: string;
  nextAction: string;
  bestTimeToCall: string;
}

// ── Main page ──────────────────────────────────────────────────────────────
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

  // AI insights state
  const [insights, setInsights] = useState<AiInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  function loadAll() {
    api.get<Lead>(`/leads/${id}`).then(setLead);
    api.get<CallLog[]>(`/calls?lead_id=${id}`).then(setCalls);
    api.get<FollowUp[]>(`/followups?lead_id=${id}`).then(setFollowups);
  }

  useEffect(() => {
    loadAll();
    api.get<User[]>('/users').then(setUsers);
    setInsights(null);
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

  async function fetchInsights() {
    setInsightsLoading(true);
    setInsights(null);
    try {
      const data = await api.post<AiInsights>('/ai/lead-insights', { lead_id: lead!.id });
      setInsights(data);
    } catch (e: any) {
      toast(e.message || 'AI request failed', 'error');
    } finally {
      setInsightsLoading(false);
    }
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
          {/* Contact details */}
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

          {/* AI Insights */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2">
                <Sparkles size={16} className="text-teal" />
                AI Insights
              </h2>
              {insights && (
                <button
                  onClick={() => setInsights(null)}
                  className="text-muted hover:text-white"
                  title="Clear"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {!insights && !insightsLoading && (
              <div className="text-center py-4">
                <p className="text-xs text-muted mb-3">
                  Analyse this lead's call history and follow-ups with Claude.
                </p>
                <button onClick={fetchInsights} className="btn btn-teal w-full text-sm py-2">
                  <Sparkles size={14} /> Get AI Insights
                </button>
              </div>
            )}

            {insightsLoading && (
              <div className="flex flex-col items-center gap-2 py-6 text-muted">
                <Loader2 size={22} className="animate-spin text-teal" />
                <span className="text-xs">Analysing lead…</span>
              </div>
            )}

            {insights && !insightsLoading && (
              <div className="space-y-3 text-sm">
                {/* Score badge */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">Lead Score</span>
                  <ScoreBadge score={insights.score} />
                </div>

                <div>
                  <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1">Summary</p>
                  <p className="text-sm leading-relaxed">{insights.summary}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1">Next Action</p>
                  <p className="text-sm leading-relaxed text-teal">{insights.nextAction}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1">Best Time to Call</p>
                  <p className="text-sm leading-relaxed">{insights.bestTimeToCall}</p>
                </div>

                <button
                  onClick={fetchInsights}
                  className="btn btn-ghost w-full text-xs py-1.5 mt-1"
                >
                  <Sparkles size={12} /> Refresh
                </button>
              </div>
            )}
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

// ── Sub-components ─────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: 'Hot' | 'Warm' | 'Cold' }) {
  const map: Record<string, string> = {
    Hot: 'bg-red-500/20 text-red-400 border border-red-500/30',
    Warm: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    Cold: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${map[score] || ''}`}>
      {score === 'Hot' ? '🔥' : score === 'Warm' ? '☀️' : '❄️'} {score}
    </span>
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

// ── Log Call modal with "Improve with AI" ──────────────────────────────────
function LogCallModal({ leadId, onClose, onDone }: { leadId: number; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [outcome, setOutcome] = useState('Interested');
  const [mins, setMins] = useState(0);
  const [secs, setSecs] = useState(0);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  // AI note improvement
  const [improving, setImproving] = useState(false);
  const [improved, setImproved] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    try {
      await api.post('/calls', {
        lead_id: leadId,
        outcome,
        duration_seconds: mins * 60 + secs,
        notes: improved ?? notes,
      });
      toast('Call logged');
      onDone();
    } catch (e: any) {
      toast(e.message, 'error');
      setBusy(false);
    }
  }

  async function improveWithAI() {
    if (!notes.trim()) {
      toast('Write a rough note first, then improve it', 'error');
      return;
    }
    setImproving(true);
    setImproved(null);
    try {
      const data = await api.post<{ improved: string }>('/ai/improve-note', { note: notes });
      setImproved(data.improved);
    } catch (e: any) {
      toast(e.message || 'AI request failed', 'error');
    } finally {
      setImproving(false);
    }
  }

  function acceptImproved() {
    setNotes(improved!);
    setImproved(null);
  }

  function dismissImproved() {
    setImproved(null);
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
        <textarea
          rows={4}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            if (improved) setImproved(null);
          }}
          placeholder="What happened on the call?"
        />
      </Field>

      {/* Improve with AI button */}
      {!improved && (
        <button
          onClick={improveWithAI}
          disabled={improving || !notes.trim()}
          className="flex items-center gap-1.5 text-xs text-teal hover:text-teal/80 disabled:opacity-40 disabled:cursor-not-allowed mb-1 -mt-1"
        >
          {improving ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {improving ? 'Improving…' : 'Improve with AI'}
        </button>
      )}

      {/* AI suggestion panel */}
      {improved && (
        <div className="rounded-lg border border-teal/30 bg-teal/5 p-3 mb-3 -mt-1 space-y-2">
          <p className="text-xs font-medium text-teal flex items-center gap-1">
            <Sparkles size={12} /> AI suggestion
          </p>
          <p className="text-sm leading-relaxed">{improved}</p>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={acceptImproved}
              className="flex items-center gap-1 text-xs btn btn-teal py-1 px-2.5"
            >
              <ThumbsUp size={11} /> Accept
            </button>
            <button
              onClick={dismissImproved}
              className="flex items-center gap-1 text-xs btn btn-ghost py-1 px-2.5"
            >
              <X size={11} /> Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 mt-4">
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

// ── Schedule Follow-up modal ───────────────────────────────────────────────
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
