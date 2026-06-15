import { useEffect, useState } from 'react';
import { Plus, Check, X, Shield, UserCog, User as UserIcon } from 'lucide-react';
import { api, User } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { can } from '../lib/constants';
import { Avatar, Modal, Field, StatCard } from '../components/ui';

// Permission reference rows: [label, admin, manager, employee]
const PERM_ROWS: [string, boolean, boolean, boolean][] = [
  ['View all leads', true, true, true],
  ['Edit own assigned leads', true, true, true],
  ['Edit any lead', true, true, false],
  ['Delete leads', true, true, false],
  ['Log calls on any lead', true, true, true],
  ['Manage follow-ups', true, true, true],
  ['Bulk reassign leads', true, true, false],
  ['CSV bulk import', true, true, false],
  ['Set call targets', true, true, false],
  ['View Team Targets', true, true, true],
];

export default function UserMgmt() {
  const { user } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  function load() {
    api.get<User[]>('/users').then(setUsers);
  }
  useEffect(load, []);

  const admins = users.filter((u) => u.role === 'admin').length;
  const managers = users.filter((u) => u.role === 'manager').length;
  const employees = users.filter((u) => u.role === 'employee').length;
  const canManage = can(user?.role, 'manageUsers');

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">User Management</h1>
        {canManage && (
          <button onClick={() => setShowAdd(true)} className="btn btn-teal">
            <Plus size={16} /> Add User
          </button>
        )}
      </div>
      <p className="text-muted text-sm mb-6">Manage team accounts, roles, and permissions</p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Admins" value={admins} accent="#14b8a6" sub="Full access to everything" />
        <StatCard label="Managers" value={managers} accent="#8b5cf6" sub="Manage leads, targets & imports" />
        <StatCard label="Employees" value={employees} accent="#f59e0b" sub="Work assigned leads & log calls" />
      </div>

      {/* Members */}
      <div className="card mb-6 overflow-hidden">
        <div className="px-5 py-3 border-b border-border font-semibold text-sm">Team Members</div>
        <table className="w-full text-sm">
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border first:border-0">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar initials={u.avatar_initials} color={u.avatar_color} size={32} />
                    <div>
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-muted">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-right">
                  <RoleBadge role={u.role} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Permissions reference */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-border font-semibold text-sm">Permissions Reference</div>
        <table className="w-full text-sm">
          <thead className="text-muted text-xs">
            <tr>
              <th className="text-left px-5 py-2.5 font-medium">Capability</th>
              <th className="px-5 py-2.5 font-medium text-teal">Admin</th>
              <th className="px-5 py-2.5 font-medium text-purple-400">Manager</th>
              <th className="px-5 py-2.5 font-medium text-amber-400">Employee</th>
            </tr>
          </thead>
          <tbody>
            {PERM_ROWS.map(([label, a, m, e]) => (
              <tr key={label} className="border-t border-border">
                <td className="px-5 py-2.5 text-muted">{label}</td>
                <Cell on={a} />
                <Cell on={m} />
                <Cell on={e} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddUser
          onClose={() => setShowAdd(false)}
          onDone={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function Cell({ on }: { on: boolean }) {
  return (
    <td className="px-5 py-2.5 text-center">
      {on ? (
        <Check size={16} className="text-green-400 inline" />
      ) : (
        <X size={16} className="text-red-400/60 inline" />
      )}
    </td>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { cls: string; Icon: any }> = {
    admin: { cls: 'text-teal bg-teal/15', Icon: Shield },
    manager: { cls: 'text-purple-400 bg-purple-500/15', Icon: UserCog },
    employee: { cls: 'text-amber-400 bg-amber-500/15', Icon: UserIcon },
  };
  const { cls, Icon } = map[role] || map.employee;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      <Icon size={12} /> {role}
    </span>
  );
}

function AddUser({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('employee');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!name.trim()) err.name = 'Required';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) err.email = 'Valid email required';
    if (password.length < 6) err.password = 'Min 6 characters';
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    try {
      await api.post('/users', { name, email, password, role });
      toast('User created');
      onDone();
    } catch (e: any) {
      toast(e.message, 'error');
      setBusy(false);
    }
  }

  return (
    <Modal title="Add User" onClose={onClose}>
      <form onSubmit={save}>
        <Field label="Name" error={errors.name}>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Email" error={errors.email}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" error={errors.password}>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Role">
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn btn-teal">
            {busy ? 'Creating…' : 'Add User'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
