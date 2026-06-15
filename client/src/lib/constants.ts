// Status badge colors (text + bg tint)
export const STATUS_STYLES: Record<string, { dot: string; cls: string }> = {
  New: { dot: '#3b82f6', cls: 'text-blue-400 bg-blue-500/15' },
  Contacted: { dot: '#a855f7', cls: 'text-purple-400 bg-purple-500/15' },
  'Call Again': { dot: '#f97316', cls: 'text-orange-400 bg-orange-500/15' },
  'Follow-up': { dot: '#eab308', cls: 'text-yellow-400 bg-yellow-500/15' },
  Qualified: { dot: '#22c55e', cls: 'text-green-400 bg-green-500/15' },
  Closed: { dot: '#15803d', cls: 'text-green-500 bg-green-700/20' },
  Lost: { dot: '#ef4444', cls: 'text-red-400 bg-red-500/15' },
};

export const PIPELINE_ORDER = [
  'New',
  'Call Again',
  'Contacted',
  'Follow-up',
  'Qualified',
  'Closed',
  'Lost',
];

export const ALL_STATUSES = [
  'New',
  'Contacted',
  'Call Again',
  'Follow-up',
  'Qualified',
  'Closed',
  'Lost',
];

// Call outcome colors
export const OUTCOME_STYLES: Record<string, { color: string; cls: string }> = {
  Interested: { color: '#22c55e', cls: 'text-green-400 bg-green-500/15' },
  Converted: { color: '#3b82f6', cls: 'text-blue-400 bg-blue-500/15' },
  Callback: { color: '#eab308', cls: 'text-yellow-400 bg-yellow-500/15' },
  'No Answer': { color: '#94a3b8', cls: 'text-slate-400 bg-slate-500/15' },
  'Not Interested': { color: '#ef4444', cls: 'text-red-400 bg-red-500/15' },
  'Wrong Number': { color: '#64748b', cls: 'text-slate-400 bg-slate-600/20' },
};

export const OUTCOMES = [
  'Interested',
  'Converted',
  'Callback',
  'No Answer',
  'Not Interested',
  'Wrong Number',
];

export const INDUSTRIES = ['Vehicle', 'Food', 'Service', 'Technology', 'Other'];

// Permission matrix (mirror of server). Per-lead edit handled separately.
export const PERMISSIONS: Record<string, string[]> = {
  viewAllLeads: ['admin', 'manager', 'employee'],
  editOwnLeads: ['admin', 'manager', 'employee'],
  editAnyLead: ['admin', 'manager'],
  deleteLeads: ['admin', 'manager'],
  logCalls: ['admin', 'manager', 'employee'],
  manageFollowUps: ['admin', 'manager', 'employee'],
  bulkReassign: ['admin', 'manager'],
  csvImport: ['admin', 'manager'],
  setCallTargets: ['admin', 'manager'],
  viewTeamTargets: ['admin', 'manager', 'employee'],
  manageUsers: ['admin'],
};

export function can(role: string | undefined, perm: string): boolean {
  if (!role) return false;
  return (PERMISSIONS[perm] || []).includes(role);
}
