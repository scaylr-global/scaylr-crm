import { useEffect, useState } from 'react';
import { api, TargetRow } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { can } from '../lib/constants';
import { Avatar, StatCard, Modal, Field } from '../components/ui';

export default function TeamTargets() {
  const { user } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<TargetRow[]>([]);
  const [editing, setEditing] = useState<TargetRow | null>(null);
  const [value, setValue] = useState(0);

  function load() {
    api.get<TargetRow[]>('/targets').then(setRows);
  }
  useEffect(load, []);

  const canSet = can(user?.role, 'setCallTargets');
  const callsToday = rows.reduce((s, r) => s + r.calls_today, 0);
  const onTarget = rows.filter((r) => r.daily_target > 0 && r.calls_today >= r.daily_target).length;

  async function save() {
    if (!editing) return;
    await api.post('/targets', { user_id: editing.id, daily_target: value });
    toast(`Target set for ${editing.name}`);
    setEditing(null);
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Team Targets</h1>
      <p className="text-muted text-sm mb-6">Set daily call quotas and track today's progress per team member</p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Calls Today" value={callsToday} accent="#3b82f6" />
        <StatCard label="On Target" value={`${onTarget}/${rows.length}`} accent="#14b8a6" />
        <StatCard label="Team Size" value={rows.length} accent="#fff" />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-muted text-xs">
            <tr>
              <th className="text-left px-5 py-3 font-medium">Member</th>
              <th className="text-left px-5 py-3 font-medium">Today's Calls</th>
              <th className="text-left px-5 py-3 font-medium w-1/3">Progress</th>
              <th className="text-right px-5 py-3 font-medium">Target</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pct = r.daily_target ? Math.min(100, Math.round((r.calls_today / r.daily_target) * 100)) : 0;
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar initials={r.avatar_initials} color={r.avatar_color} size={32} />
                      <div>
                        <div className="font-medium">{r.name}</div>
                        <span className="text-xs text-muted capitalize bg-white/5 px-1.5 py-0.5 rounded">
                          {r.role}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">{r.calls_today}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: pct >= 100 ? '#22c55e' : '#14b8a6' }}
                        />
                      </div>
                      <span className="text-xs text-muted w-12">
                        {r.calls_today}/{r.daily_target || '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {canSet ? (
                      <button
                        onClick={() => {
                          setEditing(r);
                          setValue(r.daily_target);
                        }}
                        className="btn btn-ghost py-1 text-xs"
                      >
                        {r.daily_target ? `Edit (${r.daily_target}/day)` : 'Set Target'}
                      </button>
                    ) : (
                      <span className="text-muted text-xs">{r.daily_target || '—'}/day</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={`Set target — ${editing.name}`} onClose={() => setEditing(null)}>
          <Field label="Daily call target">
            <input type="number" min={0} value={value} onChange={(e) => setValue(Math.max(0, +e.target.value))} autoFocus />
          </Field>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setEditing(null)} className="btn btn-ghost">
              Cancel
            </button>
            <button onClick={save} className="btn btn-teal">
              Save
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
