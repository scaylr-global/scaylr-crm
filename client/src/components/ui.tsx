import { ReactNode } from 'react';
import { X } from 'lucide-react';
import { STATUS_STYLES, OUTCOME_STYLES } from '../lib/constants';

export function Avatar({
  initials,
  color,
  size = 32,
}: {
  initials: string;
  color: string;
  size?: number;
}) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold text-black shrink-0"
      style={{ background: color, width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || { dot: '#94a3b8', cls: 'text-slate-400 bg-slate-500/15' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {status}
    </span>
  );
}

export function OutcomeBadge({ outcome }: { outcome: string }) {
  const s = OUTCOME_STYLES[outcome] || { color: '#94a3b8', cls: 'text-slate-400 bg-slate-500/15' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      {outcome}
    </span>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-white/5 text-muted border border-border">
      {children}
    </span>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`card mt-16 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-lg">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-white">
            <X size={20} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-3">
      <label className="block text-xs text-muted mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="text-center text-muted text-sm py-10">{children}</div>;
}

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="card p-5">
      <div className="text-muted text-sm">{label}</div>
      <div className="text-3xl font-bold mt-1" style={{ color: accent }}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}
