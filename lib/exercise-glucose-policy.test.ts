import { describe, expect, it } from 'vitest';
import {
  POST_EXERCISE_RECOVERY_REVIEW_MAX_MMOL_L,
  PRE_EXERCISE_REVIEW_MAX_MMOL_L,
  PRE_EXERCISE_REVIEW_MIN_MMOL_L,
  evaluateExerciseGlucose,
} from './exercise-glucose-policy';

describe('versioned exercise glucose policy', () => {
  it('keeps missing and invalid values separate', () => {
    expect(evaluateExerciseGlucose('pre', null, 'mmol/L').status).toBe('missing');
    expect(evaluateExerciseGlucose('pre', 0, 'mmol/L').status).toBe('invalid');
    expect(evaluateExerciseGlucose('post', 721, 'mg/dL').status).toBe('invalid');
  });

  it('uses inclusive pre-exercise reviewed boundaries', () => {
    expect(evaluateExerciseGlucose('pre', PRE_EXERCISE_REVIEW_MIN_MMOL_L, 'mmol/L').status).toBe('within_reviewed_range');
    expect(evaluateExerciseGlucose('pre', PRE_EXERCISE_REVIEW_MIN_MMOL_L - 0.001, 'mmol/L').status).toBe('below_review_range');
    expect(evaluateExerciseGlucose('pre', PRE_EXERCISE_REVIEW_MAX_MMOL_L, 'mmol/L').status).toBe('within_reviewed_range');
    expect(evaluateExerciseGlucose('pre', PRE_EXERCISE_REVIEW_MAX_MMOL_L + 0.001, 'mmol/L').status).toBe('above_review_range');
  });

  it('normalizes mg/dL before applying the same pre-exercise policy', () => {
    expect(evaluateExerciseGlucose('pre', 90, 'mg/dL').status).toBe('below_review_range');
    expect(evaluateExerciseGlucose('pre', 100, 'mg/dL').status).toBe('within_reviewed_range');
    expect(evaluateExerciseGlucose('pre', 251, 'mg/dL').status).toBe('above_review_range');
  });

  it('uses an inclusive post-exercise recovery-review boundary', () => {
    expect(evaluateExerciseGlucose('post', POST_EXERCISE_RECOVERY_REVIEW_MAX_MMOL_L, 'mmol/L').status).toBe('recovery_review');
    expect(evaluateExerciseGlucose('post', POST_EXERCISE_RECOVERY_REVIEW_MAX_MMOL_L + 0.001, 'mmol/L').status).toBe('within_reviewed_range');
    expect(evaluateExerciseGlucose('post', PRE_EXERCISE_REVIEW_MAX_MMOL_L + 0.001, 'mmol/L').status).toBe('above_review_range');
    expect(evaluateExerciseGlucose('post', 100, 'mg/dL').status).toBe('recovery_review');
  });
});
