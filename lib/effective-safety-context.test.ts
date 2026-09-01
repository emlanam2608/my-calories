import { describe, expect, it } from 'vitest';
import { safetyReasonCodeSchema } from './contracts';
import { getCopy } from './copy';
import {
  RECENT_WORKOUT_SAFETY_DAYS,
  WORKOUT_READINESS_VALID_DAYS,
  resolveEffectiveSafetyContext,
  type EffectiveSafetyContextInput,
} from './effective-safety-context';

const now = new Date('2026-09-01T00:00:00.000Z');
const onboarding = {
  id: 'onboarding-a',
  updatedAt: now,
  draft: {
    ageYears: 34,
    pregnancyContext: 'not_applicable' as const,
    symptomFlags: ['none' as const],
    clinicianRestrictionFlags: [],
    medicationExerciseRiskFlags: [],
  },
};
const readiness = {
  id: 'readiness-a',
  status: 'cleared' as const,
  flags: [],
  confirmedAt: now,
};

function resolve(overrides: Partial<EffectiveSafetyContextInput> = {}) {
  return resolveEffectiveSafetyContext({ now, onboarding, readiness, workoutLogs: [], ...overrides });
}

describe('effective safety context', () => {
  it('allows all exercise recommendation domains with current cleared facts', () => {
    const context = resolve();
    expect(context.contextVersion).toBe('effective-safety-context-1');
    expect(Object.values(context.decisions).map((decision) => decision.status)).toEqual(['allowed', 'allowed', 'allowed']);
    expect(context.sources.map((source) => source.recordId)).toEqual(['onboarding-a', 'readiness-a']);
  });

  it('blocks when age or readiness is missing', () => {
    const context = resolve({ onboarding: { ...onboarding, draft: { ...onboarding.draft, ageYears: undefined } }, readiness: undefined });
    expect(context.decisions.workout_plan).toMatchObject({
      status: 'blocked',
      reasons: [
        { code: 'age_unconfirmed', copyKey: 'safetyContext.reasons.age_unconfirmed' },
        { code: 'readiness_missing', copyKey: 'safetyContext.reasons.readiness_missing' },
      ],
    });
  });

  it('blocks under-18, pregnancy, and structured medication risks', () => {
    const context = resolve({
      onboarding: { ...onboarding, draft: { ...onboarding.draft, ageYears: 17, pregnancyContext: 'pregnant', medicationExerciseRiskFlags: ['glucose_lowering_without_plan'] } },
    });
    expect(context.facts.eligibility.state).toBe('under_18');
    expect(context.decisions.coach_exercise.status).toBe('blocked');
    expect(context.decisions.coach_exercise.reasons.map((reason) => reason.code)).toEqual(['under_18', 'pregnancy_review', 'medication_glucose_risk']);
  });

  it.each([
    ['chestPain', 'readiness_chest_pain'],
    ['faintingOrDizziness', 'readiness_fainting_or_dizziness'],
    ['severeShortnessOfBreath', 'readiness_severe_shortness_of_breath'],
    ['irregularHeartbeat', 'readiness_irregular_heartbeat'],
    ['clinicianRestriction', 'readiness_clinician_restriction'],
    ['exerciseGlucoseRisk', 'readiness_exercise_glucose_risk'],
  ] as const)('blocks every domain for readiness flag %s', (flag, reason) => {
    const context = resolve({ readiness: { ...readiness, status: 'needs_review', flags: [flag] } });
    expect(Object.values(context.decisions).every((decision) => decision.status === 'blocked')).toBe(true);
    expect(context.decisions.workout_plan.reasons[0].code).toBe(reason);
  });

  it.each([
    ['chest_discomfort', 'reported_chest_discomfort'],
    ['dizziness', 'reported_dizziness'],
    ['shortness_of_breath', 'reported_shortness_of_breath'],
  ] as const)('blocks every domain for reported symptom %s', (symptom, reason) => {
    const context = resolve({ onboarding: { ...onboarding, draft: { ...onboarding.draft, symptomFlags: [symptom] } } });
    expect(context.decisions.workout_plan.status).toBe('blocked');
    expect(context.decisions.workout_plan.reasons[0].code).toBe(reason);
  });

  it('treats the exact readiness recency boundary as current and older data as stale', () => {
    const boundary = new Date(now.getTime() - WORKOUT_READINESS_VALID_DAYS * 86_400_000);
    expect(resolve({ readiness: { ...readiness, confirmedAt: boundary } }).facts.readiness.state).toBe('cleared');
    const context = resolve({ readiness: { ...readiness, confirmedAt: new Date(boundary.getTime() - 1) } });
    expect(context.facts.readiness.state).toBe('stale');
    expect(context.decisions.workout_plan.reasons[0].code).toBe('readiness_stale');
  });

  it('blocks an invalid or future readiness timestamp instead of treating it as cleared', () => {
    const context = resolve({ readiness: { ...readiness, confirmedAt: new Date(now.getTime() + 1) } });
    expect(context.facts.readiness).toMatchObject({ state: 'invalid', confirmedAt: null });
    expect(context.decisions.workout_plan.reasons[0].code).toBe('readiness_invalid');
  });

  it('keeps clinician restrictions as modifications without erasing a stronger block', () => {
    const modified = resolve({ onboarding: { ...onboarding, draft: { ...onboarding.draft, clinicianRestrictionFlags: ['avoid_resistance', 'avoid_impact'] } } });
    expect(modified.decisions.workout_plan.status).toBe('allowed_with_modifications');
    expect(modified.decisions.workout_plan.reasons.map((reason) => reason.code)).toEqual(['clinician_avoid_resistance', 'clinician_avoid_impact']);
    const blocked = resolve({ readiness: { ...readiness, status: 'needs_review', flags: ['chestPain'] }, onboarding: { ...onboarding, draft: { ...onboarding.draft, clinicianRestrictionFlags: ['avoid_resistance'] } } });
    expect(blocked.decisions.workout_plan.status).toBe('blocked');
  });

  it('holds progression for recent pain/symptoms and ignores a log older than the exact window', () => {
    const boundary = new Date(now.getTime() - RECENT_WORKOUT_SAFETY_DAYS * 86_400_000);
    const context = resolve({ workoutLogs: [{ id: 'log-current', completedAt: boundary, pain: true, concerningSymptoms: true, preGlucose: 5.6, postGlucose: 6.1 }] });
    expect(context.decisions.workout_plan.status).toBe('allowed_with_modifications');
    expect(context.decisions.workout_progression.status).toBe('blocked');
    expect(context.facts.glucose.pre).toMatchObject({ state: 'reported', valueMmolL: 5.6 });
    const old = resolve({ workoutLogs: [{ id: 'log-old', completedAt: new Date(boundary.getTime() - 1), pain: true, concerningSymptoms: true, preGlucose: 5.6, postGlucose: 6.1 }] });
    expect(old.decisions.workout_progression.status).toBe('allowed');
    expect(old.facts.glucose.pre.state).toBe('missing');
  });

  it('keeps missing and invalid glucose distinct and holds progression for invalid values', () => {
    expect(resolve().facts.glucose.pre.state).toBe('missing');
    const invalid = resolve({ workoutLogs: [{ id: 'log-zero', completedAt: now, pain: false, concerningSymptoms: false, preGlucose: 0, postGlucose: 41 }] });
    expect(invalid.facts.glucose.pre).toMatchObject({ state: 'invalid', valueMmolL: null });
    expect(invalid.facts.glucose.post.state).toBe('invalid');
    expect(invalid.decisions.workout_plan.status).toBe('allowed_with_modifications');
    expect(invalid.decisions.workout_progression.status).toBe('blocked');
  });

  it('applies exact glucose policy boundaries to recent exercise facts', () => {
    const withGlucose = (preGlucose: number | null, postGlucose: number | null) => resolve({
      workoutLogs: [{ id: 'log-glucose', completedAt: now, pain: false, concerningSymptoms: false, preGlucose, postGlucose }],
    });
    expect(withGlucose(5, null).decisions.workout_plan.status).toBe('allowed');
    expect(withGlucose(13.9, null).decisions.workout_plan.status).toBe('allowed');
    expect(withGlucose(4.999, null).decisions.workout_plan).toMatchObject({ status: 'blocked', reasons: [{ code: 'pre_glucose_below_review_range' }] });
    expect(withGlucose(13.901, null).decisions.workout_plan).toMatchObject({ status: 'blocked', reasons: [{ code: 'pre_glucose_above_review_range' }] });
    const recovery = withGlucose(null, 5.6);
    expect(recovery.decisions.workout_plan.status).toBe('allowed_with_modifications');
    expect(recovery.decisions.workout_progression.status).toBe('blocked');
    expect(recovery.decisions.coach_exercise.status).toBe('blocked');
  });

  it('returns deterministically ordered reasons and sources', () => {
    const input: Partial<EffectiveSafetyContextInput> = {
      onboarding: { ...onboarding, draft: { ...onboarding.draft, ageYears: 16, symptomFlags: ['dizziness'], clinicianRestrictionFlags: ['monitor_glucose'] } },
      workoutLogs: [{ id: 'log-a', completedAt: now, pain: true, concerningSymptoms: false, preGlucose: null, postGlucose: null }],
    };
    expect(resolve(input)).toEqual(resolve(input));
    expect(resolve(input).decisions.workout_progression.reasons.map((reason) => reason.code)).toEqual(['under_18', 'reported_dizziness', 'clinician_monitor_glucose', 'recent_workout_pain']);
  });

  it('has English and Vietnamese professional-care copy for every reason code', () => {
    for (const locale of ['en', 'vi'] as const) {
      const reasons = getCopy(locale).safetyContext.reasons as Record<string, string>;
      for (const code of safetyReasonCodeSchema.options)
        expect(reasons[code]?.trim().length).toBeGreaterThan(20);
    }
  });
});
