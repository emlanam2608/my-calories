export const defaultTargets = [
  { metric: 'calories', value: 1850, unit: 'kcal' },
  { metric: 'protein', value: 90, unit: 'g' },
  { metric: 'fiber', value: 28, unit: 'g' },
  { metric: 'sodium', value: 2000, unit: 'mg' },
] as const;

export type TargetMetric = (typeof defaultTargets)[number]['metric'];
export type TargetAuthority = 'guideline_default' | 'user_defined' | 'clinician_defined';

export function selectTargets(rows: Array<{ metric: string; valueScaled: number; valueScale: number; unit: string; authority: string; updatedAt: Date }>) {
  const rank: Record<TargetAuthority, number> = { guideline_default: 1, user_defined: 2, clinician_defined: 3 };
  return defaultTargets.map((fallback) => {
    const candidates = rows.filter((row) => row.metric === fallback.metric && isAuthority(row.authority) && Number.isSafeInteger(row.valueScaled) && Number.isSafeInteger(row.valueScale) && row.valueScaled >= 0 && row.valueScale > 0).sort((a, b) => rank[b.authority as TargetAuthority] - rank[a.authority as TargetAuthority] || b.updatedAt.getTime() - a.updatedAt.getTime());
    const selected = candidates[0];
    return selected ? { metric: fallback.metric, value: selected.valueScaled / selected.valueScale, unit: selected.unit, authority: selected.authority as TargetAuthority } : { ...fallback, authority: 'guideline_default' as const };
  });
}

function isAuthority(value: string): value is TargetAuthority { return value === 'guideline_default' || value === 'user_defined' || value === 'clinician_defined'; }
