import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { Users, TrendingUp, PhoneCall, AlertTriangle, Clock } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toDate } from '../lib/utils';
import { api } from '../lib/api';
import { OUTCOME_STYLES } from '../lib/constants';
import { StatCard, OutcomeBadge, Avatar, Empty, DaysBadge, StatusBadge } from '../components/ui';

export default function Dashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.get('/dashboard').then(setData);
  }, []);

  if (!data) return <div className="text-muted">Loading…</div>;

  const { stats, outcomes, team, overdueList, recentCalls, staleLeads } = data;
  const totalOutcomes = outcomes.reduce((s: number, o: any) => s + o.count, 0) || 1;
  const pieData = outcomes.filter((o: any) => o.count > 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
      <p className="text-muted text-sm mb-6">Your team's pipeline at a glance</p>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Leads" value={stats.totalLeads} accent="#fff" />
        <StatCard label="Conversion Rate" value={`${stats.conversionRate}%`} accent="#14b8a6" sub="Closed / total" />
        <StatCard label="Total Calls Made" value={stats.totalCalls} accent="#3b82f6" />
        <StatCard label="Follow-ups Overdue" value={stats.overdue} accent={stats.overdue ? '#ef4444' : '#fff'} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Donut */}
        <div className="card p-5">
          <h2 className="font-semibold mb-4">Call Outcomes</h2>
          {pieData.length === 0 ? (
            <Empty>No calls logged yet</Empty>
          ) : (
            <div className="flex items-center gap-6">
              <div style={{ width: 180, height: 180 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pieData} dataKey="count" nameKey="outcome" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {pieData.map((o: any) => (
                        <Cell key={o.outcome} fill={OUTCOME_STYLES[o.outcome]?.color || '#94a3b8'} stroke="#0a0a0f" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 flex-1">
                {outcomes.map((o: any) => (
                  <div key={o.outcome} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: OUTCOME_STYLES[o.outcome]?.color }} />
                      {o.outcome}
                    </span>
                    <span className="text-white">
                      {o.count} <span className="text-muted">({Math.round((o.count / totalOutcomes) * 100)}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bar */}
        <div className="card p-5">
          <h2 className="font-semibold mb-4">Outcome Breakdown</h2>
          {pieData.length === 0 ? (
            <Empty>No data yet</Empty>
          ) : (
            <div style={{ height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={outcomes} layout="vertical" margin={{ left: 30 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="outcome" width={90} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8 }} cursor={{ fill: '#ffffff08' }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {outcomes.map((o: any) => (
                      <Cell key={o.outcome} fill={OUTCOME_STYLES[o.outcome]?.color || '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Team progress */}
      <div className="card p-5 mb-6">
        <h2 className="font-semibold mb-4">Team Progress (today)</h2>
        <div className="space-y-3">
          {team.map((m: any) => {
            const pct = m.daily_target ? Math.min(100, Math.round((m.calls_today / m.daily_target) * 100)) : 0;
            return (
              <div key={m.id} className="flex items-center gap-3">
                <Avatar initials={m.avatar_initials} color={m.avatar_color} size={32} />
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span>{m.name} <span className="text-muted text-xs capitalize">· {m.role}</span></span>
                    <span className="text-muted">
                      {m.calls_today}/{m.daily_target || '—'} calls
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Needs Follow-up (stale leads) */}
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Clock size={16} className="text-orange-400" />
            Needs Follow-up
          </h2>
          <Link to="/leads" className="text-xs text-teal hover:underline">View all leads</Link>
        </div>
        {!staleLeads || staleLeads.length === 0 ? (
          <Empty>All active leads contacted recently 🎉</Empty>
        ) : (
          <div className="space-y-2">
            {staleLeads.map((l: any) => (
              <Link
                key={l.id}
                to={`/leads/${l.id}`}
                className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2.5 hover:bg-white/10 transition-colors lift-hover"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{l.name}</div>
                  {l.company && <div className="text-xs text-muted truncate">{l.company}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={l.status} />
                  <DaysBadge days={l.days_silent} />
                  {l.value > 0 && (
                    <span className="text-[10px] text-teal">LKR {Number(l.value).toLocaleString()}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Overdue follow-ups */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Overdue Follow-ups</h2>
            <Link to="/followups" className="text-xs text-teal hover:underline">View all</Link>
          </div>
          {overdueList.length === 0 ? (
            <Empty>Nothing overdue 🎉</Empty>
          ) : (
            <div className="space-y-2">
              {overdueList.map((f: any) => (
                <Link
                  to={`/leads/${f.lead_id}`}
                  key={f.id}
                  className="block border-l-2 border-red-500 bg-white/5 rounded-r-lg px-3 py-2 hover:bg-white/10 lift-hover"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-medium">{f.lead_name}</div>
                      <div className="text-xs text-muted">{f.lead_company}</div>
                    </div>
                    <span className="text-[10px] text-red-400 bg-red-500/15 px-1.5 py-0.5 rounded-full">Overdue</span>
                  </div>
                  {f.note && <div className="text-xs text-muted mt-1">{f.note}</div>}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent calls */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent Calls</h2>
            <Link to="/leads" className="text-xs text-teal hover:underline">View leads</Link>
          </div>
          {recentCalls.length === 0 ? (
            <Empty>No calls yet</Empty>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {recentCalls.map((c: any) => (
                <div key={c.id} className="flex items-center gap-3 text-sm bg-white/5 rounded-lg px-3 py-2">
                  <OutcomeBadge outcome={c.outcome} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{c.lead_name}</div>
                    {c.notes && <div className="text-xs text-muted truncate">{c.notes}</div>}
                  </div>
                  <div className="text-right text-xs text-muted shrink-0">
                    <div>{fmtDuration(c.duration_seconds)}</div>
                    <div>{formatDistanceToNow(toDate(c.created_at), { addSuffix: true })}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
