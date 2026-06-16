import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UserPlus,
  PhoneCall,
  CalendarPlus,
  CalendarCheck,
  Trash2,
  Upload,
  ArrowRightLeft,
  Target,
  Activity as ActivityIcon,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { api, Activity } from '../lib/api';
import { Avatar, Empty } from '../components/ui';

const ICONS: Record<string, any> = {
  lead_added: UserPlus,
  status_changed: ArrowRightLeft,
  call_logged: PhoneCall,
  followup_scheduled: CalendarPlus,
  followup_completed: CalendarCheck,
  lead_deleted: Trash2,
  lead_imported: Upload,
  lead_reassigned: ArrowRightLeft,
  user_added: UserPlus,
  target_set: Target,
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'lead', label: 'Lead activity' },
  { key: 'calls', label: 'Calls' },
  { key: 'followups', label: 'Follow-ups' },
  { key: 'team', label: 'Team' },
  { key: 'user', label: 'User actions' },
];

export default function ActivityLog() {
  const [items, setItems] = useState<Activity[]>([]);
  const [filter, setFilter] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  function load() {
    const p = new URLSearchParams();
    if (filter !== 'all') p.set('filter', filter);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    api.get<Activity[]>(`/activity?${p}`).then(setItems);
  }
  useEffect(load, [filter, from, to]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Activity Log</h1>
      <p className="text-muted text-sm mb-5">Every event across your workspace, newest first</p>

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`btn py-1.5 text-xs ${filter === f.key ? 'btn-teal' : 'btn-ghost'}`}
          >
            {f.label}
          </button>
        ))}
        <div className="flex items-center gap-2 ml-auto text-xs text-muted">
          <span>From</span>
          <input type="date" className="w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span>To</span>
          <input type="date" className="w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
          {(from || to) && (
            <button
              onClick={() => {
                setFrom('');
                setTo('');
              }}
              className="text-teal hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <Empty>No activity for this filter.</Empty>
      ) : (
        <div className="card divide-y divide-border">
          {items.map((a) => {
            const Icon = ICONS[a.action_type] || ActivityIcon;
            return (
              <div key={a.id} className="flex items-center gap-4 px-5 py-3">
                <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-teal shrink-0">
                  <Icon size={17} />
                </div>
                <div className="flex-1">
                  <div className="text-sm">{a.description}</div>
                  <div className="text-xs text-muted">
                    {a.lead_name && a.lead_id && (
                      <>
                        <Link to={`/leads/${a.lead_id}`} className="text-teal hover:underline">
                          {a.lead_name}
                        </Link>{' '}
                        ·{' '}
                      </>
                    )}
                    {format(new Date(a.created_at + 'Z'), 'MMM d, yyyy · h:mm a')}
                  </div>
                </div>
                {a.avatar_initials && (
                  <div className="flex items-center gap-2 text-xs text-muted shrink-0">
                    <Avatar initials={a.avatar_initials} color={a.avatar_color || '#14b8a6'} size={22} />
                    {a.user_name}
                  </div>
                )}
                <div className="text-xs text-muted shrink-0 w-24 text-right">
                  {formatDistanceToNow(new Date(a.created_at + 'Z'), { addSuffix: true })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
