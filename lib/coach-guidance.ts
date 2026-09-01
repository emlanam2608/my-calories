export type CoachPriority =
  | 'protein'
  | 'fiber'
  | 'sodium'
  | 'health_focus'
  | 'balanced';

type DailyTotals = {
  calories: number;
  protein: number;
  fiber: number;
  sodium: number;
};

type DailyTargets = DailyTotals;

export type DailyCoachGuidance = {
  remaining: DailyTotals;
  priorities: CoachPriority[];
};

/**
 * Produces a small, explainable set of daily tracking priorities. This is not
 * a diagnostic or treatment engine: it only compares confirmed day totals to
 * the user's effective targets and the health focuses they selected.
 */
export function createDailyCoachGuidance(
  totals: DailyTotals,
  targets: DailyTargets,
  healthFocusCount: number,
): DailyCoachGuidance {
  const remaining = {
    calories: Math.max(0, targets.calories - totals.calories),
    protein: Math.max(0, targets.protein - totals.protein),
    fiber: Math.max(0, targets.fiber - totals.fiber),
    sodium: Math.max(0, targets.sodium - totals.sodium),
  };
  const priorities: CoachPriority[] = [];

  if (targets.sodium > 0 && totals.sodium >= targets.sodium) priorities.push('sodium');
  if (targets.protein > 0 && remaining.protein > 0) priorities.push('protein');
  if (targets.fiber > 0 && remaining.fiber > 0) priorities.push('fiber');
  if (healthFocusCount > 0) priorities.push('health_focus');

  return {
    remaining,
    priorities: priorities.length ? priorities.slice(0, 3) : ['balanced'],
  };
}
