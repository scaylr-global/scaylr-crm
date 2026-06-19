import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely parse a timestamp into a Date.
 *
 * Supabase returns ISO timestamps with a timezone offset already
 * (e.g. "2026-06-16T10:30:00+00:00"), whereas the old SQLite backend
 * returned naive UTC strings (e.g. "2026-06-16 10:30:00"). Appending
 * "Z" to the former produces an invalid date and crashes date-fns'
 * format() with "RangeError: Invalid time value". This helper handles
 * both shapes and never throws — invalid input falls back to epoch.
 */
export function toDate(value?: string | null): Date {
  if (!value) return new Date(0);
  let s = String(value);
  const hasTime = s.includes('T') || s.includes(' ');
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s);
  if (hasTime && !hasTz) s = s.replace(' ', 'T') + 'Z'; // treat naive as UTC
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date(0) : d;
}
