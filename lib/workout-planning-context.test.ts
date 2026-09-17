import { describe, expect, it } from 'vitest';
import type { EffectiveSafetyContext, OnboardingDraft } from './contracts';
import { buildWorkoutPlanningContext } from './workout-planning-context';
import { workoutPlanningContextSchema } from './workout-planning-contracts';

function safetyContext(
  decision: 'allowed' | 'allowed_with_modifications' | 'blocked' = 'allowed',
): EffectiveSafetyContext {
  return {
    contextVersion: 'effective-safety-context-1',
    evaluatedAt: '2026-09-06T02:00:00.000Z',
    facts: {
      eligibility: { state: 'adult', ageYears: 35 },
      pregnancyContext: 'not_applicable',
      medicationExerciseRiskFlags: [],
      readiness: {
        state: 'cleared',
        flags: [],
        confirmedAt: '2026-09-05T02:00:00.000Z',
      },
      clinicianRestrictionFlags: [],
      recentWorkoutSafety: {
        pain: false,
        concerningSymptoms: false,
        sourceRecordIds: [],
      },
      glucose: {
        policyVersion: 'ada-exercise-glucose-2026-1',
        evidenceSource: 'https://example.test/evidence',
        pre: {
          state: 'missing',
          policyStatus: 'missing',
          valueMmolL: null,
          sourceRecordId: null,
          recordedAt: null,
        },
        post: {
          state: 'missing',
          policyStatus: 'missing',
          valueMmolL: null,
          sourceRecordId: null,
          recordedAt: null,
        },
      },
    },
    decisions: {
      workout_plan: { status: decision, reasons: [] },
      workout_progression: { status: decision, reasons: [] },
      coach_exercise: { status: decision, reasons: [] },
    },
    sources: [
      {
        kind: 'onboarding',
        recordId: 'onboarding-1',
        recordedAt: '2026-09-05T01:00:00.000Z',
      },
      {
        kind: 'readiness',
        recordId: 'readiness-1',
        recordedAt: '2026-09-05T02:00:00.000Z',
      },
    ],
  };
}

const draft: OnboardingDraft = {
  goal: 'fitness',
  trainingHistory: 'beginner',
  availableDays: ['fri', 'mon', 'wed'],
  equipment: ['wall', 'bodyweight', 'exercise_mat'],
  environments: ['gym', 'home'],
  injuryFlags: [],
  clinicianRestrictionFlags: [],
};

function input(overrides: Partial<OnboardingDraft> = {}) {
  return {
    planningDate: '2026-09-06' as const,
    timezone: 'Asia/Bangkok' as const,
    onboarding: {
      recordId: 'onboarding-1',
      recordedAt: '2026-09-05T01:00:00.000Z',
      draft: { ...draft, ...overrides },
    },
    safetyContext: safetyContext(),
    currentPlan: {
      id: 'plan-1',
      planVersion: 'starter-plan-1',
      recordedAt: '2026-09-01T00:00:00.000Z',
    },
    recovery: {
      windowDays: 28,
      plannedSessions: 3,
      completedSessions: 2,
      stoppedForSafety: 0,
      painReported: false,
      concerningSymptomsReported: false,
      averageRpe: 4,
      dataCompleteness: 'partial' as const,
      sources: [
        { recordId: 'log-2', recordedAt: '2026-09-04T00:00:00.000Z' },
        { recordId: 'log-1', recordedAt: '2026-09-02T00:00:00.000Z' },
      ],
    },
  };
}

describe('workout planning context', () => {
  it('builds a bounded, source-linked context without account identity or note text', async () => {
    const context = await buildWorkoutPlanningContext(input());
    expect(context).toMatchObject({
      contextVersion: 'workout-planning-context-1',
      planningDate: '2026-09-06',
      goal: 'fitness',
      availableDays: ['mon', 'wed', 'fri'],
      equipmentCapabilities: ['bodyweight', 'exercise_mat', 'wall'],
      currentPlan: { id: 'plan-1', planVersion: 'starter-plan-1' },
      recovery: {
        windowDays: 28,
        sourceRecordIds: ['log-1', 'log-2'],
      },
    });
    expect(context.inputDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(context)).not.toMatch(
      /email|medicationNote|clinicianNote/,
    );
  });

  it('produces a stable digest for equivalent set ordering and changes for material input', async () => {
    const first = await buildWorkoutPlanningContext(input());
    const reordered = input({
      availableDays: ['wed', 'fri', 'mon'],
      equipment: ['exercise_mat', 'wall', 'bodyweight'],
      environments: ['home', 'gym'],
    });
    reordered.recovery.sources.reverse();
    const second = await buildWorkoutPlanningContext(reordered);
    expect(second.inputDigest).toBe(first.inputDigest);

    const changed = await buildWorkoutPlanningContext(
      input({ goal: 'muscle_gain' }),
    );
    expect(changed.inputDigest).not.toBe(first.inputDigest);
  });

  it('rejects missing completed-onboarding planning facts and impossible recovery counts', async () => {
    await expect(
      buildWorkoutPlanningContext(input({ goal: undefined })),
    ).rejects.toThrow('goal and training history');
    const invalid = input();
    invalid.recovery.completedSessions = 4;
    await expect(buildWorkoutPlanningContext(invalid)).rejects.toThrow(
      'cannot exceed planned',
    );
  });

  it('keeps account identity outside the strict context and requires blocked reasons', async () => {
    const valid = await buildWorkoutPlanningContext(input());
    expect(() =>
      workoutPlanningContextSchema.parse({
        ...valid,
        email: 'private@example.test',
      }),
    ).toThrow('Unrecognized key');
    expect(() =>
      workoutPlanningContextSchema.parse({
        ...valid,
        safety: { ...valid.safety, decision: 'blocked', reasonCodes: [] },
      }),
    ).toThrow('requires a safety reason');
  });
});
