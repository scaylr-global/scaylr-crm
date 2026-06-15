import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  CalendarClock,
  Target,
  Activity,
  UserCog,
  LogOut,
  Zap,
  KeyRound,
} from 'lucide-react';
import { ReactNode, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { Avatar, Modal, Field } from './ui';
import { can } from '../lib/constants';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/leads', label: 'Leads', icon: Users },
  { to: '/pipeline', label: 'Pipeline', icon: KanbanSquare },
  { to: '/followups', label: 'Follow-ups', icon: CalendarClock },
  { to: '/targets', label: 'Team Targets', icon: Target, perm: 'viewTeamTargets' },
  { to: '/activity', label: 'Activity Log', icon: Activity },
  { to: '/users', label: 'User Mgmt', icon: UserCog, perm: 'manageUsers' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showAccount, setShowAccount] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-64 shrink-0 bg-card border-r border-border flex flex-col">
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2 text-lg font-bold">
            <Zap size={22} className="text-teal" />
            <span>
              Scaylr <span className="text-teal">CRM</span>
            </span>
          </div>
          {user && (
            <div className="mt-4 flex items-center gap-3">
              <Avatar initials={user.avatar_initials} color={user.avatar_color} size={36} />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{user.name}</div>
                <div className="text-xs text-teal capitalize">{user.role}</div>
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.filter((n) => !n.perm || can(user?.role, n.perm)).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-teal/15 text-teal font-medium' : 'text-muted hover:text-white hover:bg-white/5'
                }`
              }
            >
              <n.icon size={18} />
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-border space-y-1">
          <button
            onClick={() => setShowAccount(true)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted hover:text-white hover:bg-white/5 w-full"
          >
            <KeyRound size={18} />
            Change Password
          </button>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted hover:text-red-400 hover:bg-red-500/10 w-full"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-8 py-8">{children}</div>
      </main>

      {showAccount && <ChangePasswordModal onClose={() => setShowAccount(false)} />}
    </div>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!current) err.current = 'Required';
    if (next.length < 6) err.next = 'Must be at least 6 characters';
    if (next !== confirm) err.confirm = 'Passwords do not match';
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    try {
      await api.post('/auth/change-password', { current_password: current, new_password: next });
      toast('Password changed');
      onClose();
    } catch (e: any) {
      setErrors({ current: e.message });
      setBusy(false);
    }
  }

  return (
    <Modal title="Change Password" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Current password" error={errors.current}>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />
        </Field>
        <Field label="New password" error={errors.next}>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Confirm new password" error={errors.confirm}>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn btn-teal">
            {busy ? 'Saving…' : 'Update Password'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
