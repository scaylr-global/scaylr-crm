// Status badge styles — aligned with token palette
export const STATUS_STYLES: Record<string, { dot: string; cls: string }> = {
  New:          { dot: '#4C8BD6', cls: 'text-[#4C8BD6] bg-[#4C8BD6]/15' },
  Contacted:    { dot: '#9A6CF0', cls: 'text-[#9A6CF0] bg-[#9A6CF0]/15' },
  'Call Again': { dot: '#E0A23C', cls: 'text-[#E0A23C] bg-[#E0A23C]/15' },
  'Follow-up':  { dot: '#eab308', cls: 'text-yellow-400 bg-yellow-500/15' },
  Qualified:    { dot: '#3FB984', cls: 'text-[#3FB984] bg-[#3FB984]/15' },
  Closed:       { dot: '#1FB8A6', cls: 'text-[#1FB8A6] bg-[#1FB8A6]/15' },
  Lost:         { dot: '#E0574B', cls: 'text-[#E0574B] bg-[#E0574B]/15' },
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

// Outcome colors — also used by Recharts Cell fill
export const OUTCOME_STYLES: Record<string, { color: string; cls: string }> = {
  Interested:      { color: '#3FB984', cls: 'text-[#3FB984] bg-[#3FB984]/15' },
  Converted:       { color: '#1FB8A6', cls: 'text-[#1FB8A6] bg-[#1FB8A6]/15' },
  Callback:        { color: '#E0A23C', cls: 'text-[#E0A23C] bg-[#E0A23C]/15' },
  'No Answer':     { color: '#5B6670', cls: 'text-[#8A97A3] bg-white/5' },
  'Not Interested':{ color: '#E0574B', cls: 'text-[#E0574B] bg-[#E0574B]/15' },
  'Wrong Number':  { color: '#3d4850', cls: 'text-[#5B6670] bg-white/5' },
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

export const ACTIVITY_TYPES = ['Phone Call', 'WhatsApp', 'Meeting', 'Email', 'Note'];

export const TEMP_STYLES: Record<string, { cls: string; dot: string; label: string }> = {
  Hot: { cls: 'text-red-400 bg-red-500/15 border border-red-500/30', dot: '#ef4444', label: '🔥 Hot' },
  Warm: { cls: 'text-amber-400 bg-amber-500/15 border border-amber-500/30', dot: '#f59e0b', label: '☀️ Warm' },
  Cold: { cls: 'text-blue-400 bg-blue-500/15 border border-blue-500/30', dot: '#3b82f6', label: '❄️ Cold' },
};

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
