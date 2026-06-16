export const VALUE_CAP = 500_000; // LKR

const STAGE_PTS = {
  New: 4,
  'Call Again': 8,
  Contacted: 12,
  'Follow-up': 18,
  Qualified: 26,
  Closed: 30,
  Lost: 0,
};

const WIN_PCT = {
  New: 5,
  'Call Again': 15,
  Contacted: 20,
  'Follow-up': 40,
  Qualified: 50,
  Closed: 100,
  Lost: 0,
};

// calls: [{outcome, pain_points, objections, next_step}], newest first
export function computeScore(lead, calls) {
  const stagePts = STAGE_PTS[lead.status] ?? 0;

  // Responsiveness — penalise silent days + consecutive no-answers
  const daysSilent = lead.days_silent ?? 0;
  let respPts = Math.max(0, 25 - daysSilent);
  const last3 = calls.slice(0, 3);
  const noAnswers = last3.filter((c) => c.outcome === 'No Answer').length;
  respPts = Math.max(0, respPts - 5 * noAnswers);

  // Value pts (0-20)
  const valuePts =
    lead.value > 0
      ? Math.round(20 * Math.min(lead.value, VALUE_CAP) / VALUE_CAP)
      : 0;

  // Qualification pts (0-25)
  const hasPain = calls.some((c) => c.pain_points?.trim());
  const hasPositive = calls.some(
    (c) => c.outcome === 'Interested' || c.outcome === 'Converted'
  );
  const hasNextStep = calls.some((c) => c.next_step?.trim());
  // Objection raised at some point and a LATER call was positive
  const objThenPositive = calls.some((c, i) => {
    if (!c.objections?.trim()) return false;
    return calls
      .slice(0, i)
      .some((newer) => newer.outcome === 'Interested' || newer.outcome === 'Converted');
  });
  const qualPts = Math.min(
    25,
    (hasPain ? 10 : 0) +
      (hasPositive ? 8 : 0) +
      (hasNextStep ? 3 : 0) +
      (objThenPositive ? 4 : 0)
  );

  return Math.min(100, stagePts + respPts + valuePts + qualPts);
}

export function getTemperature(score, isHot) {
  if (isHot) return 'Hot';
  if (score >= 70) return 'Hot';
  if (score >= 40) return 'Warm';
  return 'Cold';
}

export function getWinPct(status) {
  return WIN_PCT[status] ?? 0;
}
