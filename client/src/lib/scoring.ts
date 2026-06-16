export const VALUE_CAP = 500_000;

const STAGE_PTS: Record<string, number> = {
  New: 4, 'Call Again': 8, Contacted: 12, 'Follow-up': 18, Qualified: 26, Closed: 30, Lost: 0,
};
const WIN_PCT: Record<string, number> = {
  New: 5, 'Call Again': 15, Contacted: 20, 'Follow-up': 40, Qualified: 50, Closed: 100, Lost: 0,
};

export function computeScore(lead: { status: string; days_silent?: number; value?: number | null; is_hot?: number | boolean }, calls: { outcome?: string; pain_points?: string | null; next_step?: string | null; objections?: string | null }[]): number {
  const stagePts = STAGE_PTS[lead.status] ?? 0;
  const daysSilent = lead.days_silent ?? 0;
  let respPts = Math.max(0, 25 - daysSilent);
  const noAnswers = calls.slice(0, 3).filter(c => c.outcome === 'No Answer').length;
  respPts = Math.max(0, respPts - 5 * noAnswers);
  const valuePts = (lead.value ?? 0) > 0 ? Math.round(20 * Math.min(lead.value!, VALUE_CAP) / VALUE_CAP) : 0;
  const hasPain = calls.some(c => c.pain_points?.trim());
  const hasPositive = calls.some(c => c.outcome === 'Interested' || c.outcome === 'Converted');
  const hasNextStep = calls.some(c => c.next_step?.trim());
  const objThenPositive = calls.some((c, i) =>
    c.objections?.trim() && calls.slice(0, i).some(n => n.outcome === 'Interested' || n.outcome === 'Converted')
  );
  const qualPts = Math.min(25,
    (hasPain ? 10 : 0) + (hasPositive ? 8 : 0) + (hasNextStep ? 3 : 0) + (objThenPositive ? 4 : 0)
  );
  return Math.min(100, stagePts + respPts + valuePts + qualPts);
}

export function getTemperature(score: number, isHot: number | boolean): 'Hot' | 'Warm' | 'Cold' {
  if (isHot) return 'Hot';
  if (score >= 70) return 'Hot';
  if (score >= 40) return 'Warm';
  return 'Cold';
}

export function getWinPct(status: string): number {
  return WIN_PCT[status] ?? 0;
}
