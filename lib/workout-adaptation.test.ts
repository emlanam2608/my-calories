import { describe, expect, it } from 'vitest';
import {
  exerciseCatalogEntrySchema,
  type ExerciseCatalogEntry,
} from './exercise-catalog';
import {
  createWorkoutAdaptation,
  type AdaptationEvidence,
  type WorkoutAdaptationInput,
} from './workout-adaptation';
import {
  WORKOUT_ADAPTATION_POLICY,
  type WorkoutAdaptationPolicy,
} from './workout-adaptation-policy';
import {
  workoutPlanV2Schema,
  type WorkoutPlanningContext,
} from './workout-planning-contracts';

function exercise(
  id: string,
  category: ExerciseCatalogEntry['category'],
  requiredCapabilities: ExerciseCatalogEntry['requiredCapabilities'],
  substitutionIds: string[] = [],
) {
  return exerciseCatalogEntrySchema.parse({
    id,
    name: { en: id, vi: `${id}-vi` },
    category,
    requiredCapabilities,
    environments: ['home'],
    muscleGroups: ['whole_body'],
    contraindicationTags: [],
    technique: { en: 'Technique', vi: 'Kỹ thuật' },
    regression: { en: 'Regression', vi: 'Điều chỉnh' },
    progression: { en: 'Progression', vi: 'Tăng tiến' },
    substitutionIds,
    catalogVersion: 'starter-2',
    reviewStatus: 'unreviewed',
    reviewedVersion: null,
    reviewedAt: null,
    reviewReference: null,
  });
}

const catalog = [
  exercise('warm', 'mobility', ['bodyweight']),
  exercise('row', 'strength', ['resistance_band'], ['wall-row']),
  exercise('wall-row', 'strength', ['wall']),
  exercise('cool', 'mobility', ['bodyweight']),
];
const basePlan = workoutPlanV2Schema.parse({
  planVersion: 'workout-plan-v2',
  plannerVersion: 'deterministic-weekly-planner-1',
  catalogVersion: 'starter-2',
  catalogReviewStatus: 'unreviewed',
  policy: {
    version: 'synthetic-reviewed-plan-policy',
    reviewStatus: 'professionally_reviewed',
    reviewedVersion: 'test-only',
    reviewedAt: '2026-09-01',
    reviewReference: 'test-fixture-only',
  },
  safetyContextVersion: 'effective-safety-context-1',
  inputDigest: 'a'.repeat(64),
  periodStart: '2026-09-06',
  timezone: 'Asia/Bangkok',
  draftStatus: 'complete',
  appliedSafetyReasonCodes: [],
  unresolvedQuestions: [],
  sessions: [
    {
      id: 'v2-2026-09-07-strength-1',
      day: 'mon',
      date: '2026-09-07',
      purpose: 'strength',
      titleCopyKey: 'workoutPlanner.title.strength',
      rationaleCopyKeys: ['workoutPlanner.reason.strength'],
      durationMinutes: 20,
      targetRpe: 4,
      progressionCriteriaCopyKeys: ['workoutPlanner.progression.ready'],
      sections: [
        {
          phase: 'warmup',
          prescriptions: [
            {
              exerciseId: 'warm',
              allocatedMinutes: 3,
              sets: null,
              reps: null,
              durationMinutes: 3,
              restSeconds: null,
              targetRpe: 2,
              rationaleCopyKey: 'workoutPlanner.reason.warm',
              substitutionIds: [],
              modificationReasonCodes: [],
            },
          ],
        },
        {
          phase: 'strength',
          prescriptions: [
            {
              exerciseId: 'row',
              allocatedMinutes: 10,
              sets: 2,
              reps: 10,
              durationMinutes: null,
              restSeconds: 60,
              targetRpe: 4,
              rationaleCopyKey: 'workoutPlanner.reason.row',
              substitutionIds: ['wall-row'],
              modificationReasonCodes: [],
            },
          ],
        },
        {
          phase: 'cooldown',
          prescriptions: [
            {
              exerciseId: 'cool',
              allocatedMinutes: 3,
              sets: null,
              reps: null,
              durationMinutes: 3,
              restSeconds: null,
              targetRpe: 2,
              rationaleCopyKey: 'workoutPlanner.reason.cool',
              substitutionIds: [],
              modificationReasonCodes: [],
            },
          ],
        },
      ],
    },
  ],
});
const context: WorkoutPlanningContext = {
  contextVersion: 'workout-planning-context-1',
  planningDate: '2026-09-06',
  timezone: 'Asia/Bangkok',
  goal: 'fitness',
  trainingHistory: 'beginner',
  availableDays: ['mon'],
  equipmentCapabilities: ['bodyweight', 'resistance_band', 'wall'],
  environments: ['home'],
  injuryFlags: [],
  clinicianRestrictionFlags: [],
  safety: {
    contextVersion: 'effective-safety-context-1',
    decision: 'allowed',
    reasonCodes: [],
  },
  currentPlan: {
    id: '018e2aaa-6a86-4d9d-b36a-a3d96fd00ee1',
    planVersion: 'workout-plan-v2',
  },
  recovery: {
    windowDays: 28,
    plannedSessions: 2,
    completedSessions: 2,
    stoppedForSafety: 0,
    painReported: false,
    concerningSymptomsReported: false,
    averageRpe: 4,
    dataCompleteness: 'complete',
    sourceRecordIds: ['log-1', 'log-2'],
  },
  sources: [
    {
      kind: 'onboarding',
      recordId: 'onboarding',
      recordedAt: '2026-09-01T00:00:00.000Z',
    },
  ],
  inputDigest: 'b'.repeat(64),
};
const evidence: AdaptationEvidence[] = [1, 2].map((number) => ({
  id: `log-${number}`,
  sessionId: `session-${number}`,
  status: 'completed',
  evidenceVersion: 'workout-exercise-evidence-1',
  dataCompleteness: 'exercise_level_complete',
  adherenceStatus: 'complete',
  rpe: 4,
  pain: false,
  concerningSymptoms: false,
  exerciseResultIds: [`result-${number}`],
}));
const reviewedPolicy: WorkoutAdaptationPolicy = {
  ...WORKOUT_ADAPTATION_POLICY,
  reviewStatus: 'professionally_reviewed',
  reviewedVersion: 'test-only',
  reviewedAt: '2026-09-01',
  reviewReference: 'test-fixture-only',
};
function input(
  overrides: Partial<WorkoutAdaptationInput> = {},
): WorkoutAdaptationInput {
  return {
    plan: basePlan,
    context,
    progressionSafety: {
      contextVersion: context.safety.contextVersion,
      decision: context.safety.decision,
      reasonCodes: context.safety.reasonCodes,
    },
    catalog,
    evidence,
    recovery: { id: 'checkin', status: 'good', soreness: false, pain: false },
    policy: reviewedPolicy,
    ...overrides,
  };
}

describe('workout adaptation precedence and policy boundaries', () => {
  it('holds for safety before substitution or poor recovery', () => {
    const result = createWorkoutAdaptation(
      input({
        context: { ...context, equipmentCapabilities: ['bodyweight'] },
        progressionSafety: {
          contextVersion: context.safety.contextVersion,
          decision: 'blocked',
          reasonCodes: ['readiness_chest_pain'],
        },
        recovery: {
          id: 'checkin',
          status: 'poor',
          soreness: true,
          pain: false,
        },
      }),
    );
    expect(result).toMatchObject({
      action: 'hold_for_review',
      reasonCodes: ['safety_blocked'],
      proposedPlan: null,
    });
    expect(
      createWorkoutAdaptation(
        input({
          evidence: [
            {
              ...evidence[0],
              status: 'stopped_for_safety',
              adherenceStatus: 'not_counted_safety_stop',
            },
          ],
        }),
      ),
    ).toMatchObject({
      action: 'hold_for_review',
      reasonCodes: ['concerning_workout_evidence'],
    });
    expect(
      createWorkoutAdaptation(
        input({
          recovery: {
            id: 'checkin',
            status: 'good',
            soreness: false,
            pain: true,
          },
        }),
      ),
    ).toMatchObject({
      action: 'hold_for_review',
      reasonCodes: ['recovery_pain'],
    });
  });

  it('uses the stricter progression decision when plan generation remains allowed with modifications', () => {
    expect(
      createWorkoutAdaptation(
        input({
          context: {
            ...context,
            safety: {
              ...context.safety,
              decision: 'allowed_with_modifications',
              reasonCodes: ['recent_workout_pain'],
            },
          },
          progressionSafety: {
            contextVersion: context.safety.contextVersion,
            decision: 'blocked',
            reasonCodes: ['recent_workout_pain'],
          },
          evidence: [],
        }),
      ),
    ).toMatchObject({
      action: 'hold_for_review',
      reasonCodes: ['safety_blocked'],
    });
  });

  it('substitutes before recovery rules and exposes unresolved substitution requirements', () => {
    const compatible = createWorkoutAdaptation(
      input({
        context: { ...context, equipmentCapabilities: ['bodyweight', 'wall'] },
        recovery: {
          id: 'checkin',
          status: 'poor',
          soreness: true,
          pain: false,
        },
      }),
    );
    expect(compatible).toMatchObject({
      action: 'substitute',
      changes: [{ exerciseId: 'row', after: { exerciseId: 'wall-row' } }],
    });
    const unresolved = createWorkoutAdaptation(
      input({ context: { ...context, equipmentCapabilities: ['bodyweight'] } }),
    );
    expect(unresolved).toMatchObject({
      action: 'substitute',
      proposedPlan: null,
      reasonCodes: ['exercise_incompatible', 'substitution_unresolved'],
    });
    expect(
      createWorkoutAdaptation(
        input({ context: { ...context, environments: ['outdoors'] } }),
      ),
    ).toMatchObject({ action: 'substitute', proposedPlan: null });
  });

  it('deloads at poor recovery or the exact excess-effort threshold', () => {
    expect(
      createWorkoutAdaptation(
        input({
          recovery: {
            id: 'checkin',
            status: 'poor',
            soreness: false,
            pain: false,
          },
        }),
      ).action,
    ).toBe('deload');
    const below = evidence.map((log) => ({ ...log, rpe: 5.9 }));
    expect(createWorkoutAdaptation(input({ evidence: below }))).toMatchObject({
      action: 'maintain',
      reasonCodes: ['maintenance_appropriate'],
    });
    const boundary = evidence.map((log) => ({ ...log, rpe: 6 }));
    const result = createWorkoutAdaptation(input({ evidence: boundary }));
    expect(result).toMatchObject({
      action: 'deload',
      reasonCodes: ['excess_effort'],
    });
    expect(
      result.changes.find((change) => change.exerciseId === 'row')?.after,
    ).toMatchObject({ sets: 1, reps: 8, targetRpe: 3 });
  });

  it('maintains for fatigue, sparse, duplicate, legacy, or unreviewed evidence', () => {
    expect(
      createWorkoutAdaptation(
        input({
          recovery: {
            id: 'checkin',
            status: 'some_fatigue',
            soreness: false,
            pain: false,
          },
        }),
      ).reasonCodes,
    ).toEqual(['some_fatigue']);
    expect(
      createWorkoutAdaptation(input({ evidence: evidence.slice(0, 1) }))
        .reasonCodes,
    ).toEqual(['insufficient_evidence']);
    expect(
      createWorkoutAdaptation(
        input({
          evidence: [
            evidence[0],
            { ...evidence[1], sessionId: evidence[0].sessionId },
          ],
        }),
      ).reasonCodes,
    ).toEqual(['duplicate_session_evidence']);
    expect(
      createWorkoutAdaptation(
        input({
          evidence: evidence.map((log) => ({
            ...log,
            evidenceVersion: 'legacy-aggregate-1',
            dataCompleteness: 'legacy_aggregate',
            adherenceStatus: 'legacy_unknown',
          })),
        }),
      ).reasonCodes,
    ).toEqual(['legacy_evidence']);
    expect(
      createWorkoutAdaptation(input({ policy: WORKOUT_ADAPTATION_POLICY }))
        .reasonCodes,
    ).toEqual(['progression_policy_unreviewed']);
  });

  it('progresses only with reviewed policy, adequate adherence, good recovery, and bounded effort', () => {
    const result = createWorkoutAdaptation(input());
    expect(result).toMatchObject({
      action: 'progress',
      dataCompleteness: 'complete',
      confidence: 'high',
    });
    expect(
      result.changes.find((change) => change.exerciseId === 'row')?.after,
    ).toMatchObject({ reps: 11 });
    expect(
      result.changes.find((change) => change.exerciseId === 'warm')?.after,
    ).toMatchObject({ durationMinutes: 5 });
    const mixed = [
      evidence[0],
      { ...evidence[1], adherenceStatus: 'partial' as const },
    ];
    expect(
      createWorkoutAdaptation(
        input({
          evidence: mixed,
          policy: { ...reviewedPolicy, minimumAdherenceRatio: 0.75 },
        }),
      ).action,
    ).toBe('progress');
    expect(
      createWorkoutAdaptation(
        input({
          evidence: mixed,
          policy: { ...reviewedPolicy, minimumAdherenceRatio: 0.751 },
        }),
      ).reasonCodes,
    ).toEqual(['insufficient_evidence']);
  });
});
