import { ReactNode } from 'react';
import { cn } from '../lib/utils';

// ── Status badge ────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { dot: string; cls: string }> = {
  New:        { dot: 'var(--info)',    cls: 'text-[#4C8BD6] bg-[#4C8BD6]/15' },
  Contacted:  { dot: '#a855f7',       cls: 'text-purple-400 bg-purple-500/15' },
  'Call Again':{ dot: 'var(--warning)',cls: 'text-[#E0A23C] bg-[#E0A23C]/15' },
  'Follow-up':{ dot: '#eab308',       cls: 'text-yellow-400 bg-yellow-500/15' },
  Qualified:  { dot: 'var(--success)',  cls: 'text-[#3FB984] bg-[#3FB984]/15' },
  Closed:     { dot: '#15803d',       cls: 'text-green-500 bg-green-700/20' },
  Lost:       { dot: 'var(--danger)', cls: 'text-[#E0574B] bg-[#E0574B]/15' },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || { dot: 'var(--text-muted)', cls: 'text-[color:var(--text-muted)] bg-white/5' };
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium tabular', s.cls)}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
      {status}
    </span>
  );
}

// ── Outcome badge ────────────────────────────────────────────────────────────

const OUTCOME_MAP: Record<string, { color: string; cls: string }> = {
  Interested:     { color: 'var(--success)', cls: 'text-[#3FB984] bg-[#3FB984]/15' },
  Converted:      { color: 'var(--accent)',  cls: 'text-[#1FB8A6] bg-[#1FB8A6]/15' },
  Callback:       { color: 'var(--warning)', cls: 'text-[#E0A23C] bg-[#E0A23C]/15' },
  'No Answer':    { color: 'var(--text-muted)', cls: 'text-[color:var(--text-muted)] bg-white/5' },
  'Not Interested':{ color: 'var(--danger)', cls: 'text-[#E0574B] bg-[#E0574B]/15' },
  'Wrong Number': { color: 'var(--text-faint)', cls: 'text-[color:var(--text-faint)] bg-white/5' },
};

export function OutcomeBadge({ outcome }: { outcome: string }) {
  const s = OUTCOME_MAP[outcome] || { color: 'var(--text-muted)', cls: 'text-[color:var(--text-muted)] bg-white/5' };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', s.cls)}>
      {outcome}
    </span>
  );
}

// ── Temperature badge ────────────────────────────────────────────────────────

const TEMP_MAP: Record<string, { cls: string; dot: string; label: string }> = {
  Hot:  { cls: 'text-[#E0574B] bg-[#E0574B]/12 border border-[#E0574B]/25', dot: 'var(--danger)', label: '🔥 Hot' },
  Warm: { cls: 'text-[#E0A23C] bg-[#E0A23C]/12 border border-[#E0A23C]/25', dot: 'var(--warning)', label: '☀️ Warm' },
  Cold: { cls: 'text-[#4C8BD6] bg-[#4C8BD6]/12 border border-[#4C8BD6]/25', dot: 'var(--info)', label: '❄️ Cold' },
};

export function TempBadge({ temperature }: { temperature: string }) {
  const s = TEMP_MAP[temperature] || TEMP_MAP.Cold;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full', s.cls)}>
      {s.label}
    </span>
  );
}

// ── Score + Temp chip (the signature component) ──────────────────────────────

export function ScoreChip({ score, winPct, temperature }: { score: number; winPct: number; temperature?: string }) {
  const dotColor =
    temperature === 'Hot'  ? 'var(--danger)'  :
    temperature === 'Warm' ? 'var(--warning)' :
                             'var(--text-faint)';
  const scoreColor =
    score >= 70 ? 'var(--accent)' :
    score >= 40 ? 'var(--warning)' :
                  'var(--text-muted)';

  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 tabular">
      {temperature && (
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
      )}
      <span className="font-bold tabular" style={{ color: scoreColor, fontVariantNumeric: 'tabular-nums' }}>{score}</span>
      <span style={{ color: 'var(--text-faint)' }}>· {winPct}%</span>
    </span>
  );
}

// ── Days-silent badge ────────────────────────────────────────────────────────

export function DaysBadge({ days }: { days: number }) {
  if (days < 7) return null;
  const cls =
    days >= 30 ? 'text-[#E0574B] bg-[#E0574B]/12' :
    days >= 14 ? 'text-[#E0A23C] bg-[#E0A23C]/12' :
                 'text-yellow-400 bg-yellow-500/12';
  return (
    <span className={cn('inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full tabular', cls)}>
      {days}d silent
    </span>
  );
}

// ── Generic Pill ─────────────────────────────────────────────────────────────

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs bg-white/5 border font-medium',
      'text-[color:var(--text-muted)]',
      className
    )}
    style={{ borderColor: 'var(--border-strong)' }}
    >
      {children}
    </span>
  );
}
