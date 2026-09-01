import { normalizeMeasurement } from './measurement-conversions';

export const EXERCISE_GLUCOSE_POLICY_VERSION = 'ada-exercise-glucose-2026-1' as const;
export const EXERCISE_GLUCOSE_EVIDENCE_SOURCE = 'https://diabetesjournals.org/care/article/49/Supplement_1/S89/163932/5-Facilitating-Positive-Health-Behaviors-and-Well';
export const PRE_EXERCISE_REVIEW_MIN_MMOL_L = 5;
export const PRE_EXERCISE_REVIEW_MAX_MMOL_L = 13.9;
export const POST_EXERCISE_RECOVERY_REVIEW_MAX_MMOL_L = 5.6;

export type ExerciseGlucosePolicyStatus =
  | 'missing'
  | 'invalid'
  | 'within_reviewed_range'
  | 'below_review_range'
  | 'above_review_range'
  | 'recovery_review';

export function evaluateExerciseGlucose(
  timing: 'pre' | 'post',
  value: number | null,
  unit: 'mmol/L' | 'mg/dL',
) {
  if (value === null)
    return { status: 'missing' as const, valueMmolL: null };
  if (!Number.isFinite(value) || value <= 0)
    return { status: 'invalid' as const, valueMmolL: null };
  const valueMmolL = normalizeMeasurement({
    metric: 'blood_glucose',
    value,
    unit,
  }).value;
  if (!Number.isFinite(valueMmolL) || valueMmolL <= 0 || valueMmolL > 40)
    return { status: 'invalid' as const, valueMmolL: null };
  if (timing === 'pre') {
    if (valueMmolL < PRE_EXERCISE_REVIEW_MIN_MMOL_L)
      return { status: 'below_review_range' as const, valueMmolL };
    if (valueMmolL > PRE_EXERCISE_REVIEW_MAX_MMOL_L)
      return { status: 'above_review_range' as const, valueMmolL };
    return { status: 'within_reviewed_range' as const, valueMmolL };
  }
  if (valueMmolL <= POST_EXERCISE_RECOVERY_REVIEW_MAX_MMOL_L)
    return { status: 'recovery_review' as const, valueMmolL };
  if (valueMmolL > PRE_EXERCISE_REVIEW_MAX_MMOL_L)
    return { status: 'above_review_range' as const, valueMmolL };
  return { status: 'within_reviewed_range' as const, valueMmolL };
}
