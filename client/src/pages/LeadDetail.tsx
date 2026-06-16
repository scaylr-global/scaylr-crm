import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
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
  Flame,
  TrendingUp,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { api, Lead, CallLog, FollowUp, User, CallPrep, Intel } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { OUTCOMES, ACTIVITY_TYPES } from '../lib/constants';
import { StatusBadge, OutcomeBadge, Pill, Avatar, Modal, Field, Empty, TempBadge, ScoreChip, DaysBadge } from '../components/ui';
import LeadForm, { LeadFormValues } from '../components/LeadForm';

type Tab = 'callprep' | 'activity' | 'followups' | 'intel';

function toWaHref(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return `https://wa.me/94${digits.slice(1)}`;
  if (digits.length === 9) return `https://wa.me/94${digits}`;
  return `https://wa.me/${digits}`;
}

interface LeadDetailProps {
  isDrawer?: boolean;
  drawerLeadId?: number;
  onDrawerRefreshList?: () => void;
}

export default function LeadDetail({ isDrawer, drawerLeadId, onDrawerRefreshList }: LeadDetailProps = {}) {
  const params = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  // In drawer mode use drawerLeadId; in full-page mode use route :id
  const id = isDrawer ? String(drawerLeadId) : params.id;

  const [lead, setLead] = useState<Lead | null>(null);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [callPrep, setCallPrep] = useState<CallPrep | null>(null);
  const [intel, setIntel] = useState<Intel | null>(null);
  const [tab, setTab] = useState<Tab>('callprep');

  const [showActivity, setShowActivity] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [showLost, setShowLost] = useState(false);
  const [hotBusy, setHotBusy] = useState(false);

  function loadLead() {
    api.get<Lead>(`/leads/${id}`).then(setLead);
  }
  function loadCalls() {
    api.get<CallLog[]>(`/calls?lead_id=${id}`).then(setCalls);
  }
  function loadFollowups() {
    api.get<FollowUp[]>(`/followups?lead_id=${id}`).then(setFollowups);
  }
  function loadCallPrep() {
    api.get<CallPrep>(`/leads/${id}/call-prep`).then(setCallPrep);
  }
  function loadIntel() {
    api.get<Intel>(`/leads/${id}/intel`).then(setIntel);
  }

  function loadAll() {
    loadLead();
    loadCalls();
    loadFollowups();
    loadCallPrep();
    loadIntel();
  }

  useEffect(() => {
    loadAll();
    api.get<User[]>('/users').then(setUsers);
    // eslint-disable-next-line
  }, [id]);

  if (!lead) return <div className="text-muted">Loading…</div>;

  const canEdit = user?.role === 'admin' || user?.role === 'manager' || lead.assigned_to === user?.id;
  const canDelete = user?.role === 'admin' || user?.role === 'manager';
  const isActive = lead.status !== 'Closed' && lead.status !== 'Lost';
  const pendingFu = followups.filter((f) => f.status === 'pending').length;

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
    if (isDrawer) {
      onDrawerRefreshList?.();
      navigate('/leads');
    } else {
      navigate('/leads');
    }
  }

  async function toggleHot() {
    setHotBusy(true);
    try {
      const updated = await api.patch<Lead>(`/leads/${id}/hot`);
      setLead(updated);
      toast(updated.is_hot ? '🔥 Marked as Hot' : 'Hot flag removed');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setHotBusy(false);
    }
  }

  async function markDone(fid: number) {
    await api.patch(`/followups/${fid}/done`);
    toast('Follow-up completed');
    loadFollowups();
  }

  async function deleteCall(cid: number) {
    await api.del(`/calls/${cid}`);
    toast('Activity deleted');
    loadAll();
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'callprep', label: 'Call Prep' },
    { key: 'activity', label: 'Activity', count: calls.length },
    { key: 'followups', label: 'Follow-Ups', count: pendingFu },
    { key: 'intel', label: 'Intel' },
  ];

  return (
    <div className={isDrawer ? 'p-4' : ''}>
      {!isDrawer && (
        <Link to="/leads" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-teal mb-4">
          <ArrowLeft size={16} /> Back to Leads
        </Link>
      )}

      {/* Header card */}
      <div className={`card p-5 mb-3 ${isDrawer ? 'rounded-[var(--r-md)]' : ''}`}>
        <div className="flex items-start gap-4">
          <Avatar
            initials={(lead.name[0] || '?').toUpperCase() + (lead.name.split(' ')[1]?.[0] || '')}
            color={lead.assignee?.avatar_color || '#14b8a6'}
            size={52}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{lead.name}</h1>
              <StatusBadge status={lead.status} />
              {lead.temperature && <TempBadge temperature={lead.temperature} />}
              {lead.score !== undefined && (
                <ScoreChip score={lead.score} winPct={lead.win_pct ?? 0} />
              )}
              {(lead.days_silent ?? 0) >= 7 && <DaysBadge days={lead.days_silent!} />}
            </div>
            <div className="text-sm text-muted mt-1 flex items-center gap-2 flex-wrap">
              {lead.role_title && <span>{lead.role_title}</span>}
              {lead.company && <span>· {lead.company}</span>}
              {lead.assignee && <span>· {lead.assignee.name}</span>}
              {lead.value != null && lead.value > 0 && (
                <span className="text-teal font-medium">
                  · LKR {lead.value.toLocaleString()}
                </span>
              )}
              {lead.industry && <Pill>{lead.industry}</Pill>}
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {canEdit && (
            <>
              <button onClick={() => setShowActivity(true)} className="btn btn-teal py-1.5 text-sm">
                <Plus size={14} /> Log Activity
              </button>
              <button onClick={() => setShowSchedule(true)} className="btn btn-ghost py-1.5 text-sm">
                <CalendarClock size={14} /> Follow-Up
              </button>
            </>
          )}
          {lead.phone1 && (
            <a
              href={toWaHref(lead.phone1)}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost py-1.5 text-sm text-green-400 hover:text-green-300"
            >
              <MessageCircle size={14} /> WhatsApp
            </a>
          )}
          {canEdit && (
            <>
              <button
                onClick={toggleHot}
                disabled={hotBusy}
                className={`btn py-1.5 text-sm ${lead.is_hot ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30' : 'btn-ghost'}`}
              >
                <Flame size={14} className={lead.is_hot ? 'text-red-400' : ''} />
                {lead.is_hot ? 'Hot' : 'Mark Hot'}
              </button>
              {isActive && (
                <>
                  <button onClick={() => setShowConvert(true)} className="btn btn-ghost py-1.5 text-sm text-teal">
                    <CheckCircle2 size={14} /> Convert
                  </button>
                  <button onClick={() => setShowLost(true)} className="btn btn-ghost py-1.5 text-sm text-red-400">
                    <XCircle size={14} /> Lost
                  </button>
                </>
              )}
              <button onClick={() => setShowEdit(true)} className="btn btn-ghost py-1.5 text-sm">
                <Pencil size={14} /> Edit
              </button>
            </>
          )}
          {canDelete && (
            <button onClick={deleteLead} className="btn btn-danger py-1.5 text-sm ml-auto">
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Phone quick-access */}
      <div className="flex gap-2 mb-4">
        {lead.phone1 && <PhoneRow label="Primary" number={lead.phone1} color="#22c55e" />}
        {lead.phone2 && <PhoneRow label="Secondary" number={lead.phone2} color="#ef4444" />}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-teal text-teal'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="ml-1.5 text-xs bg-white/10 px-1.5 py-0.5 rounded-full">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'callprep' && (
        <CallPrepTab callPrep={callPrep} lead={lead} onLog={() => setShowActivity(true)} compact={isDrawer} />
      )}
      {tab === 'activity' && (
        <ActivityTab calls={calls} onDelete={deleteCall} />
      )}
      {tab === 'followups' && (
        <FollowUpsTab
          followups={followups}
          onDone={markDone}
          onSchedule={() => setShowSchedule(true)}
        />
      )}
      {tab === 'intel' && (
        <IntelTab intel={intel} compact={isDrawer} />
      )}

      {/* Modals */}
      {showActivity && (
        <LogActivityModal
          leadId={lead.id}
          onClose={() => setShowActivity(false)}
          onDone={() => { setShowActivity(false); loadAll(); setTab('activity'); }}
        />
      )}
      {showSchedule && (
        <ScheduleModal
          leadId={lead.id}
          onClose={() => setShowSchedule(false)}
          onDone={() => { setShowSchedule(false); loadFollowups(); setTab('followups'); }}
        />
      )}
      {showEdit && (
        <Modal title="Edit Lead" onClose={() => setShowEdit(false)} wide>
          <LeadForm initial={lead} users={users} onSubmit={saveEdit} onCancel={() => setShowEdit(false)} />
        </Modal>
      )}
      {showConvert && (
        <ConvertModal
          lead={lead}
          onClose={() => setShowConvert(false)}
          onDone={() => { setShowConvert(false); loadAll(); }}
        />
      )}
      {showLost && (
        <LostModal
          lead={lead}
          onClose={() => setShowLost(false)}
          onDone={() => { setShowLost(false); loadAll(); }}
        />
      )}
    </div>
  );
}

// ── Call Prep Tab ──────────────────────────────────────────────────────────

function CallPrepTab({ callPrep, lead, onLog, compact }: { callPrep: CallPrep | null; lead: Lead; onLog: () => void; compact?: boolean }) {
  if (!callPrep) return <div className="text-muted text-sm">Loading…</div>;
  if (callPrep.totalCalls === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-muted mb-4">No calls logged yet. Log the first activity to populate Call Prep.</p>
        <button onClick={onLog} className="btn btn-teal">
          <Plus size={15} /> Log First Activity
        </button>
      </div>
    );
  }
  return (
    <div className={compact ? 'flex flex-col gap-4' : 'grid grid-cols-2 gap-4'}>
      {/* Last interaction */}
      {callPrep.lastInteraction && (
        <div className="card p-4">
          <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Last Interaction</p>
          <div className="flex items-center gap-2 mb-2">
            <OutcomeBadge outcome={callPrep.lastInteraction.outcome} />
            {callPrep.lastInteraction.type && (
              <span className="text-xs text-muted">{callPrep.lastInteraction.type}</span>
            )}
          </div>
          {callPrep.lastInteraction.notes && (
            <p className="text-sm leading-relaxed">{callPrep.lastInteraction.notes}</p>
          )}
          <p className="text-xs text-muted mt-2">
            {format(new Date(callPrep.lastInteraction.date + 'Z'), 'MMM d, yyyy · h:mm a')}
          </p>
        </div>
      )}

      {/* Next step — highlighted */}
      <div className={`card p-4 ${callPrep.nextStep ? 'border-teal/40' : ''}`}>
        <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Next Step</p>
        {callPrep.nextStep ? (
          <p className="text-sm leading-relaxed text-teal font-medium">{callPrep.nextStep}</p>
        ) : (
          <p className="text-sm text-muted italic">Not defined yet</p>
        )}
      </div>

      {/* Talking points */}
      <div className="card p-4">
        <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Talking Points</p>
        {callPrep.talkingPoints ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{callPrep.talkingPoints}</p>
        ) : (
          <p className="text-sm text-muted italic">Nothing noted yet</p>
        )}
      </div>

      {/* Pain points */}
      <div className="card p-4">
        <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Pain Points</p>
        {callPrep.painPoints ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{callPrep.painPoints}</p>
        ) : (
          <p className="text-sm text-muted italic">None discovered yet</p>
        )}
      </div>

      {/* Objections */}
      <div className="card p-4" style={compact ? undefined : { gridColumn: '1 / -1' }}>
        <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Objections to Handle</p>
        {callPrep.objections ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{callPrep.objections}</p>
        ) : (
          <p className="text-sm text-muted italic">No objections logged yet</p>
        )}
      </div>
    </div>
  );
}

// ── Activity Tab ───────────────────────────────────────────────────────────

function ActivityTab({ calls, onDelete }: { calls: CallLog[]; onDelete: (id: number) => void }) {
  if (calls.length === 0) return <Empty>No activities logged yet.</Empty>;
  return (
    <div className="space-y-3">
      {calls.map((c) => (
        <div key={c.id} className="card p-4">
          <div className="flex items-start gap-3">
            <OutcomeBadge outcome={c.outcome} />
            {c.type && c.type !== 'Phone Call' && (
              <span className="text-xs text-muted bg-white/5 px-2 py-0.5 rounded-full">{c.type}</span>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted mb-1.5">
                {format(new Date(c.created_at + 'Z'), 'MMM d, yyyy · h:mm a')}
                {c.logger?.name && ` · ${c.logger.name}`}
                {c.duration_seconds > 0 && ` · ${fmtDur(c.duration_seconds)}`}
              </div>
              {c.notes && <p className="text-sm leading-relaxed mb-2">{c.notes}</p>}
              {(c.talking_points || c.pain_points || c.objections || c.next_step) && (
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs border-t border-border pt-2">
                  {c.talking_points && (
                    <div>
                      <span className="text-muted font-medium">Talking points</span>
                      <p className="mt-0.5 whitespace-pre-wrap">{c.talking_points}</p>
                    </div>
                  )}
                  {c.pain_points && (
                    <div>
                      <span className="text-amber-400 font-medium">Pain points</span>
                      <p className="mt-0.5 whitespace-pre-wrap">{c.pain_points}</p>
                    </div>
                  )}
                  {c.objections && (
                    <div>
                      <span className="text-red-400 font-medium">Objections</span>
                      <p className="mt-0.5 whitespace-pre-wrap">{c.objections}</p>
                    </div>
                  )}
                  {c.next_step && (
                    <div>
                      <span className="text-teal font-medium">Next step</span>
                      <p className="mt-0.5 whitespace-pre-wrap">{c.next_step}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button onClick={() => onDelete(c.id)} className="text-muted hover:text-red-400 shrink-0">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Follow-Ups Tab ─────────────────────────────────────────────────────────

function FollowUpsTab({
  followups,
  onDone,
  onSchedule,
}: {
  followups: FollowUp[];
  onDone: (id: number) => void;
  onSchedule: () => void;
}) {
  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={onSchedule} className="btn btn-teal py-1.5">
          <Plus size={15} /> Schedule Follow-Up
        </button>
      </div>
      {followups.length === 0 ? (
        <Empty>No follow-ups scheduled.</Empty>
      ) : (
        <div className="space-y-2">
          {followups.map((f) => {
            const done = f.status === 'done';
            return (
              <div key={f.id} className="card p-3 flex items-start gap-3">
                {done ? (
                  <Check size={16} className="text-teal mt-0.5 shrink-0" />
                ) : (
                  <CalendarClock size={16} className="text-muted mt-0.5 shrink-0" />
                )}
                <div className="flex-1">
                  <div className={`text-sm ${done ? 'line-through text-muted' : ''}`}>{f.note}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {format(new Date(f.scheduled_at + 'Z'), 'MMM d, yyyy · h:mm a')}
                    {done && ' · completed'}
                  </div>
                </div>
                {!done && (
                  <button onClick={() => onDone(f.id)} className="text-xs text-teal hover:underline shrink-0">
                    Done
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Intel Tab ──────────────────────────────────────────────────────────────

function IntelTab({ intel, compact }: { intel: Intel | null; compact?: boolean }) {
  if (!intel) return <div className="text-muted text-sm">Loading…</div>;
  const isEmpty =
    intel.allPainPoints.length === 0 &&
    intel.allObjections.length === 0 &&
    intel.outcomeHistory.length === 0;
  if (isEmpty) return <Empty>Log activities to build intelligence on this lead.</Empty>;
  return (
    <div className={compact ? 'flex flex-col gap-4' : 'grid grid-cols-2 gap-4'}>
      {/* Pain points */}
      <div className="card p-4">
        <p className="text-xs font-medium text-amber-400 uppercase tracking-wide mb-3">
          Pain Points ({intel.allPainPoints.length})
        </p>
        {intel.allPainPoints.length === 0 ? (
          <p className="text-sm text-muted italic">None discovered</p>
        ) : (
          <div className="space-y-2">
            {intel.allPainPoints.map((p, i) => (
              <div key={i} className="bg-white/5 rounded-lg p-2.5 text-sm">
                <p className="leading-relaxed">{p.text}</p>
                <p className="text-xs text-muted mt-1">
                  {format(new Date(p.date + 'Z'), 'MMM d')}
                  {p.type && ` · ${p.type}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Objections */}
      <div className="card p-4">
        <p className="text-xs font-medium text-red-400 uppercase tracking-wide mb-3">
          Objections ({intel.allObjections.length})
        </p>
        {intel.allObjections.length === 0 ? (
          <p className="text-sm text-muted italic">None raised</p>
        ) : (
          <div className="space-y-2">
            {intel.allObjections.map((o, i) => (
              <div key={i} className="bg-white/5 rounded-lg p-2.5 text-sm">
                <p className="leading-relaxed">{o.text}</p>
                <p className="text-xs text-muted mt-1">
                  {format(new Date(o.date + 'Z'), 'MMM d')}
                  {o.type && ` · ${o.type}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Next steps history */}
      {intel.allNextSteps.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-medium text-teal uppercase tracking-wide mb-3">
            Next Steps ({intel.allNextSteps.length})
          </p>
          <div className="space-y-2">
            {intel.allNextSteps.map((n, i) => (
              <div key={i} className="bg-white/5 rounded-lg p-2.5 text-sm">
                <p className="leading-relaxed">{n.text}</p>
                <p className="text-xs text-muted mt-1">{format(new Date(n.date + 'Z'), 'MMM d')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outcome history */}
      <div className="card p-4">
        <p className="text-xs font-medium text-muted uppercase tracking-wide mb-3">
          Outcome History ({intel.outcomeHistory.length})
        </p>
        <div className="space-y-1.5">
          {intel.outcomeHistory.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <OutcomeBadge outcome={o.outcome} />
              <span className="text-xs text-muted">{format(new Date(o.date + 'Z'), 'MMM d')}</span>
              {o.type && <span className="text-xs text-muted">· {o.type}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Phone row ──────────────────────────────────────────────────────────────

function PhoneRow({ label, number, color }: { label: string; number: string | null; color: string }) {
  const toast = useToast();
  if (!number) return null;
  return (
    <div className="card px-3 py-2 flex items-center gap-2 flex-1">
      <Phone size={14} style={{ color }} />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-muted">{label}</div>
        <div className="text-sm">{number}</div>
      </div>
      <a
        href={toWaHref(number)}
        target="_blank"
        rel="noreferrer"
        className="p-1 rounded hover:bg-white/10 text-green-400"
        title="WhatsApp"
      >
        <MessageCircle size={14} />
      </a>
      <button
        onClick={() => { navigator.clipboard.writeText(number); toast('Copied'); }}
        className="p-1 rounded hover:bg-white/10 text-muted"
        title="Copy"
      >
        <Copy size={14} />
      </button>
    </div>
  );
}

// ── Log Activity Modal ─────────────────────────────────────────────────────

function LogActivityModal({
  leadId,
  onClose,
  onDone,
}: { leadId: number; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [type, setType] = useState('Phone Call');
  const [outcome, setOutcome] = useState('Interested');
  const [mins, setMins] = useState(0);
  const [secs, setSecs] = useState(0);
  const [notes, setNotes] = useState('');
  const [talkingPoints, setTalkingPoints] = useState('');
  const [painPoints, setPainPoints] = useState('');
  const [objections, setObjections] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
  const [fuDate, setFuDate] = useState(new Date().toISOString().slice(0, 10));
  const [fuTime, setFuTime] = useState('09:00');
  const [fuNote, setFuNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [improving, setImproving] = useState(false);
  const [improved, setImproved] = useState<string | null>(null);

  const showOutcome = type !== 'Note' && type !== 'Meeting' && type !== 'Email';
  const showDuration = type === 'Phone Call' || type === 'WhatsApp';

  async function save() {
    setBusy(true);
    try {
      await api.post(`/leads/${leadId}/activities`, {
        type,
        outcome: showOutcome ? outcome : 'Interested',
        duration_seconds: showDuration ? mins * 60 + secs : 0,
        notes: improved ?? notes,
        talking_points: talkingPoints || null,
        pain_points: painPoints || null,
        objections: objections || null,
        next_step: nextStep || null,
        follow_up: scheduleFollowUp && fuDate && fuTime
          ? { date: fuDate, time: fuTime, note: fuNote }
          : null,
      });
      toast('Activity logged');
      onDone();
    } catch (e: any) {
      toast(e.message, 'error');
      setBusy(false);
    }
  }

  async function improveWithAI() {
    if (!notes.trim()) { toast('Write a note first', 'error'); return; }
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

  return (
    <Modal title="Log Activity" onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type *">
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {ACTIVITY_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        {showOutcome && (
          <Field label="Outcome *">
            <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              {OUTCOMES.map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
        )}
        {showDuration && (
          <Field label="Duration">
            <div className="flex items-center gap-2">
              <input type="number" min={0} value={mins} onChange={(e) => setMins(Math.max(0, +e.target.value))} />
              <span className="text-muted text-sm">min</span>
              <input type="number" min={0} max={59} value={secs} onChange={(e) => setSecs(Math.min(59, Math.max(0, +e.target.value)))} />
              <span className="text-muted text-sm">sec</span>
            </div>
          </Field>
        )}
      </div>

      <Field label="What happened">
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => { setNotes(e.target.value); if (improved) setImproved(null); }}
          placeholder="Summary of this interaction…"
        />
      </Field>

      {!improved && (
        <button
          onClick={improveWithAI}
          disabled={improving || !notes.trim()}
          className="flex items-center gap-1.5 text-xs text-teal hover:text-teal/80 disabled:opacity-40 -mt-1 mb-2"
        >
          {improving ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {improving ? 'Improving…' : 'Improve with AI'}
        </button>
      )}
      {improved && (
        <div className="rounded-lg border border-teal/30 bg-teal/5 p-3 mb-3 -mt-1 space-y-2">
          <p className="text-xs font-medium text-teal flex items-center gap-1"><Sparkles size={12} /> AI suggestion</p>
          <p className="text-sm leading-relaxed">{improved}</p>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={() => { setNotes(improved!); setImproved(null); }} className="btn btn-teal py-1 px-2.5 text-xs">
              <ThumbsUp size={11} /> Accept
            </button>
            <button onClick={() => setImproved(null)} className="btn btn-ghost py-1 px-2.5 text-xs">
              <X size={11} /> Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Talking Points">
          <textarea rows={2} value={talkingPoints} onChange={(e) => setTalkingPoints(e.target.value)} placeholder="Key topics discussed…" />
        </Field>
        <Field label="Pain Points">
          <textarea rows={2} value={painPoints} onChange={(e) => setPainPoints(e.target.value)} placeholder="Problems they mentioned…" />
        </Field>
        <Field label="Objections">
          <textarea rows={2} value={objections} onChange={(e) => setObjections(e.target.value)} placeholder="Concerns or pushback…" />
        </Field>
        <Field label="Next Step">
          <textarea rows={2} value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="What's agreed to happen next…" />
        </Field>
      </div>

      {/* Follow-up checkbox */}
      <label className="flex items-center gap-2 text-sm cursor-pointer mb-3">
        <input
          type="checkbox"
          className="w-4 h-4 accent-teal"
          checked={scheduleFollowUp}
          onChange={(e) => setScheduleFollowUp(e.target.checked)}
        />
        Schedule a follow-up now
      </label>
      {scheduleFollowUp && (
        <div className="bg-white/5 rounded-lg p-3 mb-3 space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input type="date" value={fuDate} onChange={(e) => setFuDate(e.target.value)} />
            </Field>
            <Field label="Time">
              <input type="time" value={fuTime} onChange={(e) => setFuTime(e.target.value)} />
            </Field>
          </div>
          <Field label="Follow-up note">
            <input value={fuNote} onChange={(e) => setFuNote(e.target.value)} placeholder="What's this follow-up about?" />
          </Field>
        </div>
      )}

      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onClose} className="btn btn-ghost">Cancel</button>
        <button onClick={save} disabled={busy} className="btn btn-teal">
          {busy ? 'Saving…' : 'Log Activity'}
        </button>
      </div>
    </Modal>
  );
}

// ── Schedule Follow-up Modal ───────────────────────────────────────────────

function ScheduleModal({
  leadId,
  onClose,
  onDone,
}: { leadId: number; onClose: () => void; onDone: () => void }) {
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
      const utc = new Date(`${date}T${time}:00`).toISOString().slice(0, 19).replace('T', ' ');
      await api.post('/followups', { lead_id: leadId, scheduled_at: utc, note });
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
        <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Time"><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
      </div>
      <Field label="Note">
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's the follow-up about?" />
      </Field>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="btn btn-ghost">Cancel</button>
        <button onClick={save} disabled={busy} className="btn btn-teal">{busy ? 'Saving…' : 'Schedule'}</button>
      </div>
    </Modal>
  );
}

// ── Convert Modal ──────────────────────────────────────────────────────────

function ConvertModal({ lead, onClose, onDone }: { lead: Lead; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [pkg, setPkg] = useState('');
  const [mrr, setMrr] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api.patch(`/leads/${lead.id}/convert`, { package: pkg, mrr: mrr ? Number(mrr) : null });
      toast(`${lead.name} converted!`);
      onDone();
    } catch (e: any) {
      toast(e.message, 'error');
      setBusy(false);
    }
  }

  return (
    <Modal title={`Convert ${lead.name}`} onClose={onClose}>
      <p className="text-sm text-muted mb-4">Mark this lead as Closed/Won and record the deal details.</p>
      <Field label="Package / Plan">
        <input value={pkg} onChange={(e) => setPkg(e.target.value)} placeholder="e.g. Pro Annual, Starter" />
      </Field>
      <Field label="Monthly Recurring Revenue (LKR)">
        <input type="number" min={0} value={mrr} onChange={(e) => setMrr(e.target.value)} placeholder="e.g. 25000" />
      </Field>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="btn btn-ghost">Cancel</button>
        <button onClick={save} disabled={busy} className="btn btn-teal">
          <CheckCircle2 size={15} /> {busy ? 'Converting…' : 'Convert'}
        </button>
      </div>
    </Modal>
  );
}

// ── Lost Modal ─────────────────────────────────────────────────────────────

function LostModal({ lead, onClose, onDone }: { lead: Lead; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api.patch(`/leads/${lead.id}/lost`, { reason });
      toast(`${lead.name} marked as Lost`);
      onDone();
    } catch (e: any) {
      toast(e.message, 'error');
      setBusy(false);
    }
  }

  return (
    <Modal title={`Mark ${lead.name} as Lost`} onClose={onClose}>
      <p className="text-sm text-muted mb-4">Record why this lead didn't convert so you can improve future pitches.</p>
      <Field label="Reason (optional)">
        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Price too high, went with competitor, not ready…" />
      </Field>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="btn btn-ghost">Cancel</button>
        <button onClick={save} disabled={busy} className="btn btn-danger">
          <XCircle size={15} /> {busy ? 'Saving…' : 'Mark as Lost'}
        </button>
      </div>
    </Modal>
  );
}

function fmtDur(s: number) {
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}
