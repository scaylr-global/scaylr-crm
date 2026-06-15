import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Check, AlertTriangle } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { api, FollowUp, User } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { StatusBadge, Empty } from '../components/ui';

export default function FollowUps() {
  const toast = useToast();
  const [items, setItems] = useState<FollowUp[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [assignee, setAssignee] = useState('all');

  function load() {
    const q = assignee !== 'all' ? `?assignee=${assignee}&status=pending` : '?status=pending';
    api.get<FollowUp[]>(`/followups${q}`).then(setItems);
  }
  useEffect(() => {
    api.get<User[]>('/users').then(setUsers);
  }, []);
  useEffect(load, [assignee]);

  async function done(id: number) {
    await api.patch(`/followups/${id}/done`);
    toast('Follow-up completed');
    load();
  }
  async function remove(id: number) {
    if (!confirm('Delete this follow-up?')) return;
    await api.del(`/followups/${id}`);
    toast('Follow-up deleted');
    load();
  }

  const now = new Date();
  const overdue = items.filter((f) => new Date(f.scheduled_at) < now);
  const upcoming = items.filter((f) => new Date(f.scheduled_at) >= now);

  // group upcoming by date
  const groups: Record<string, FollowUp[]> = {};
  upcoming.forEach((f) => {
    const key = format(new Date(f.scheduled_at), 'EEEE, MMM d');
    (groups[key] = groups[key] || []).push(f);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          Follow-ups
          <span className="text-sm bg-white/10 text-muted px-2 py-0.5 rounded-full">{items.length} pending</span>
        </h1>
        <div className="flex items-center gap-3">
          {overdue.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/15 px-2.5 py-1 rounded-full">
              <AlertTriangle size={13} /> {overdue.length} overdue
            </span>
          )}
          <select className="w-auto" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="all">All team members</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {items.length === 0 && <Empty>No pending follow-ups. 🎉</Empty>}

      {overdue.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-red-400 mb-2">OVERDUE</h2>
          <div className="space-y-2">
            {overdue.map((f) => (
              <FollowCard key={f.id} f={f} overdue onDone={done} onDelete={remove} />
            ))}
          </div>
        </div>
      )}

      {Object.entries(groups).map(([day, list]) => (
        <div key={day} className="mb-6">
          <h2 className="text-sm font-semibold text-muted mb-2">{day}</h2>
          <div className="space-y-2">
            {list.map((f) => (
              <FollowCard key={f.id} f={f} onDone={done} onDelete={remove} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FollowCard({
  f,
  overdue,
  onDone,
  onDelete,
}: {
  f: FollowUp;
  overdue?: boolean;
  onDone: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className={`card p-4 flex items-start gap-4 ${overdue ? 'border-l-2 border-l-red-500' : ''}`}>
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <Link to={`/leads/${f.lead_id}`} className="font-semibold hover:text-teal">
            {f.lead_name}
          </Link>
          {f.lead_status && <StatusBadge status={f.lead_status} />}
        </div>
        <div className="text-xs text-muted">{f.lead_company}</div>
        {f.note && <div className="text-sm mt-1.5">{f.note}</div>}
        <div className="text-xs text-muted mt-1.5">
          {format(new Date(f.scheduled_at), 'MMM d, yyyy · h:mm a')}
          {f.assignee_name && ` · ${f.assignee_name}`}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => onDone(f.id)} className="btn py-1.5 bg-teal/15 text-teal hover:bg-teal/25">
          <Check size={14} /> Done
        </button>
        <button onClick={() => onDelete(f.id)} className="text-muted hover:text-red-400 p-1.5">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
