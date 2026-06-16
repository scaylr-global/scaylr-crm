// Central UI primitives — re-exports new badge.tsx + local components
// All callers import from here; badge.tsx is also importable directly.
import { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

export {
  StatusBadge,
  OutcomeBadge,
  TempBadge,
  ScoreChip,
  DaysBadge,
  Pill,
} from './badge';

// ── Avatar ───────────────────────────────────────────────────────────────────
export function Avatar({ initials, color, size = 32 }: { initials: string; color: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold shrink-0"
      style={{
        background: color,
        width: size,
        height: size,
        fontSize: size * 0.38,
        color: '#0B0F12',
      }}
    >
      {initials}
    </div>
  );
}

// ── Modal (Dialog overlay) ───────────────────────────────────────────────────
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
      className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(11,15,18,0.65)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className={cn('mt-16 w-full shadow-2xl rounded-[var(--r-lg)]', wide ? 'max-w-3xl' : 'max-w-lg')}
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h3 className="font-semibold text-[15px]" style={{ color: 'var(--text)' }}>{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md transition-colors hover:bg-white/10"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ── Field (form label wrapper) ────────────────────────────────────────────────
export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <label className="label-xs block mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{error}</p>}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
      {children}
    </div>
  );
}

// ── Stat card (dashboard) ─────────────────────────────────────────────────────
export function StatCard({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: string; accent?: string }) {
  return (
    <div className="card p-5">
      <div className="label-xs">{label}</div>
      <div className="metric mt-2" style={{ color: accent || 'var(--text)' }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>{sub}</div>}
    </div>
  );
}
