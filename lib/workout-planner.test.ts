import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  exerciseCatalogEntrySchema,
  type ExerciseCapability,
  type ExerciseCatalogEntry,
} from './exercise-catalog';
import { evaluateExerciseCatalog } from './exercise-eligibility';
import {
  workoutPlanV2Schema,
  type WorkoutPlanningContext,
} from './workout-planning-contracts';
import { createDeterministicWorkoutPlan } from './workout-planner';

function exercise(
  id: string,
  category: ExerciseCatalogEntry['category'],
  capability: ExerciseCapability = 'bodyweight',
  overrides: Partial<ExerciseCatalogEntry> = {},
) {
  return exerciseCatalogEntrySchema.parse({
    id,
    name: { en: id, vi: `${id}-vi` },
    category,
    requiredCapabilities: [capability],
    environments: ['home', 'outdoors', 'gym'],
    muscleGroups: ['whole_body'],
    contraindicationTags: [],
    technique: { en: 'Technique', vi: 'Kỹ thuật' },
    regression: { en: 'Regression', vi: 'Điều chỉnh' },
    progression: { en: 'Progression', vi: 'Tăng tiến' },
    substitutionIds: [],
    catalogVersion: 'starter-2',
    reviewStatus: 'unreviewed',
    reviewedVersion: null,
    reviewedAt: null,
    reviewReference: null,
    ...overrides,
  });
}

const catalog = [
  exercise('mobility-basic', 'mobility'),
  exercise('strength-basic', 'strength'),
  exercise('aerobic-basic', 'aerobic'),
];

function context(
  overrides: Partial<WorkoutPlanningContext> = {},
): WorkoutPlanningContext {
  return {
    contextVersion: 'workout-planning-context-1',
    planningDate: '2026-09-06',
    timezone: 'Asia/Bangkok',
    goal: 'fitness',
    trainingHistory: 'beginner',
    availableDays: ['mon', 'wed', 'fri'],
    equipmentCapabilities: ['bodyweight'],
    environments: ['home'],
    injuryFlags: [],
    clinicianRestrictionFlags: [],
    safety: {
      contextVersion: 'effective-safety-context-1',
      decision: 'allowed',
      reasonCodes: [],
    },
    currentPlan: null,
    recovery: {
      windowDays: 28,
      plannedSessions: 0,
      completedSessions: 0,
      stoppedForSafety: 0,
      painReported: false,
      concerningSymptomsReported: false,
      averageRpe: null,
      dataCompleteness: 'none',
      sourceRecordIds: [],
    },
    sources: [
      {
        kind: 'onboarding',
        recordId: 'onboarding-1',
        recordedAt: '2026-09-05T00:00:00.000Z',
      },
    ],
    inputDigest: 'a'.repeat(64),
    ...overrides,
  };
}

function draftPlan(planningContext: WorkoutPlanningContext, entries = catalog) {
  const result = createDeterministicWorkoutPlan(planningContext, entries);
  expect(result.status).toBe('draft');
  if (result.status !== 'draft') throw new Error('Expected a draft plan.');
  return result.plan;
}

describe('deterministic weekly workout planner', () => {
  it('returns identical output for identical input with stable date-based session IDs', () => {
    const input = context();
    const first = createDeterministicWorkoutPlan(input, catalog);
    const second = createDeterministicWorkoutPlan(
      input,
      [...catalog].reverse(),
    );
    expect(second).toEqual(first);
    const plan = draftPlan(input);
    expect(plan.sessions.map((session) => session.id)).toEqual([
      'v2-2026-09-07-aerobic-1',
      'v2-2026-09-09-strength-2',
      'v2-2026-09-11-mobility-3',
    ]);
    expect(plan).toMatchObject({
      plannerVersion: 'deterministic-weekly-planner-1',
      catalogVersion: 'starter-2',
      catalogReviewStatus: 'unreviewed',
      policy: {
        version: 'conservative-prescription-policy-1',
        reviewStatus: 'unreviewed',
        reviewedVersion: null,
        reviewedAt: null,
        reviewReference: null,
      },
      inputDigest: input.inputDigest,
    });
  });

  it.each([
    ['weight_loss', 'aerobic'],
    ['maintain_weight', 'strength'],
    ['muscle_gain', 'strength'],
    ['fitness', 'aerobic'],
    ['health_tracking', 'mobility'],
  ] as const)(
    'uses goal %s to select the first session purpose %s',
    (goal, purpose) => {
      expect(draftPlan(context({ goal })).sessions[0]?.purpose).toBe(purpose);
    },
  );

  it('changes conservative doses by training history', () => {
    const newcomer = draftPlan(context({ trainingHistory: 'new_to_exercise' }));
    const regular = draftPlan(context({ trainingHistory: 'regular' }));
    expect(newcomer.sessions[0]).toMatchObject({
      durationMinutes: 20,
      targetRpe: 3,
    });
    expect(regular.sessions[0]).toMatchObject({
      durationMinutes: 30,
      targetRpe: 5,
    });
    expect(regular).not.toEqual(newcomer);
  });

  it.each([
    [[], 0, 'incomplete'],
    [['wed'], 1, 'complete'],
    [['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], 3, 'complete'],
  ] as const)(
    'handles %s available days without exceeding the conservative cap',
    (availableDays, count, status) => {
      const plan = draftPlan(context({ availableDays: [...availableDays] }));
      expect(plan.sessions).toHaveLength(count);
      expect(plan.draftStatus).toBe(status);
    },
  );

  it.each([
    ['home', 'wall'],
    ['outdoors', 'bicycle'],
    ['gym', 'cable_machine'],
  ] as const)(
    'enforces %s environment and %s capability independently',
    (environment, capability) => {
      const specialized = [
        exercise('mobility', 'mobility', capability, {
          environments: [environment],
        }),
        exercise('strength', 'strength', capability, {
          environments: [environment],
        }),
        exercise('aerobic', 'aerobic', capability, {
          environments: [environment],
        }),
      ];
      const plan = draftPlan(
        context({
          equipmentCapabilities: [capability],
          environments: [environment],
          availableDays: ['mon'],
        }),
        specialized,
      );
      expect(plan.draftStatus).toBe('complete');
      expect(plan.sessions).toHaveLength(1);
    },
  );

  it('returns no plan when deterministic safety blocks workout planning', () => {
    expect(
      createDeterministicWorkoutPlan(
        context({
          safety: {
            contextVersion: 'effective-safety-context-1',
            decision: 'blocked',
            reasonCodes: ['under_18'],
          },
        }),
        catalog,
      ),
    ).toEqual({
      status: 'blocked',
      plan: null,
      reasonCodes: ['under_18'],
    });
  });

  it('gives clinician restrictions precedence and hard-caps modified effort', () => {
    const plan = draftPlan(
      context({
        goal: 'muscle_gain',
        trainingHistory: 'regular',
        clinicianRestrictionFlags: ['avoid_resistance', 'avoid_high_intensity'],
        safety: {
          contextVersion: 'effective-safety-context-1',
          decision: 'allowed_with_modifications',
          reasonCodes: [
            'clinician_avoid_resistance',
            'clinician_avoid_high_intensity',
          ],
        },
      }),
    );
    expect(
      plan.sessions.every((session) => session.purpose !== 'strength'),
    ).toBe(true);
    expect(plan.sessions.every((session) => session.targetRpe <= 3)).toBe(true);
    expect(plan.appliedSafetyReasonCodes).toEqual([
      'clinician_avoid_resistance',
      'clinician_avoid_high_intensity',
    ]);
  });

  it.each([
    [
      'avoid_high_intensity',
      'clinician_avoid_high_intensity',
      'clinician_low_intensity_only',
    ],
    ['avoid_impact', 'clinician_avoid_impact', 'clinician_low_impact_only'],
    [
      'monitor_glucose',
      'clinician_monitor_glucose',
      'clinician_glucose_monitoring_required',
    ],
  ] as const)(
    'applies %s as a visible hard-capped modification',
    (restriction, safetyReason, modificationReason) => {
      const plan = draftPlan(
        context({
          trainingHistory: 'regular',
          clinicianRestrictionFlags: [restriction],
          safety: {
            contextVersion: 'effective-safety-context-1',
            decision: 'allowed_with_modifications',
            reasonCodes: [safetyReason],
          },
        }),
      );
      expect(plan.sessions.every((session) => session.targetRpe <= 3)).toBe(
        true,
      );
      expect(
        plan.sessions
          .flatMap((session) => session.sections)
          .flatMap((section) => section.prescriptions)
          .some((item) =>
            item.modificationReasonCodes.includes(modificationReason),
          ),
      ).toBe(true);
    },
  );

  it('keeps injury contraindications ahead of goal-driven selection', () => {
    const injuredCatalog = [
      exercise('mobility-basic', 'mobility'),
      exercise('strength-basic', 'strength', 'bodyweight', {
        contraindicationTags: ['back_pain'],
      }),
      exercise('aerobic-basic', 'aerobic'),
    ];
    const plan = draftPlan(
      context({
        goal: 'muscle_gain',
        injuryFlags: ['back_pain'],
        availableDays: ['mon'],
      }),
      injuredCatalog,
    );
    expect(plan.sessions).toEqual([]);
    expect(plan.unresolvedQuestions).toContainEqual(
      expect.objectContaining({ code: 'missing_strength_candidate' }),
    );
  });

  it('returns a reviewable incomplete draft when capabilities or substitutions are unresolved', () => {
    const noCandidate = draftPlan(context(), [
      exercise('wall-mobility', 'mobility', 'wall'),
      exercise('wall-strength', 'strength', 'wall'),
      exercise('wall-aerobic', 'aerobic', 'wall'),
    ]);
    expect(noCandidate).toMatchObject({
      draftStatus: 'incomplete',
      sessions: [],
    });
    expect(
      noCandidate.unresolvedQuestions.some((item) =>
        item.missingCapabilities.includes('wall'),
      ),
    ).toBe(true);

    const unresolvedSubstitution = draftPlan(
      context({ availableDays: ['mon'] }),
      [
        exercise('mobility-basic', 'mobility'),
        exercise('strength-basic', 'strength'),
        exercise('aerobic-basic', 'aerobic', 'bodyweight', {
          substitutionIds: ['wall-aerobic'],
        }),
        exercise('wall-aerobic', 'aerobic', 'wall'),
      ],
    );
    expect(unresolvedSubstitution.draftStatus).toBe('incomplete');
    expect(unresolvedSubstitution.unresolvedQuestions).toContainEqual(
      expect.objectContaining({ code: 'unresolved_substitution' }),
    );
  });

  it('references only eligible catalog rows and keeps allocated work within duration', () => {
    const input = context();
    const plan = draftPlan(input);
    const eligibleIds = new Set(
      evaluateExerciseCatalog(catalog, {
        equipment: input.equipmentCapabilities,
        environments: input.environments,
        injuryFlags: input.injuryFlags,
        clinicianRestrictionFlags: input.clinicianRestrictionFlags,
        safetyDecision: {
          status: input.safety.decision,
          reasonCodes: input.safety.reasonCodes,
        },
      })
        .filter((item) => item.eligible)
        .map((item) => item.exerciseId),
    );
    for (const session of plan.sessions) {
      const prescriptions = session.sections.flatMap(
        (section) => section.prescriptions,
      );
      expect(
        prescriptions.every((item) => eligibleIds.has(item.exerciseId)),
      ).toBe(true);
      expect(
        prescriptions.reduce((sum, item) => sum + item.allocatedMinutes, 0),
      ).toBeLessThanOrEqual(session.durationMinutes);
    }
  });

  it('cannot infer professional policy review without complete external evidence', () => {
    const plan = draftPlan(context());
    expect(() =>
      workoutPlanV2Schema.parse({
        ...plan,
        policy: { ...plan.policy, reviewStatus: 'professionally_reviewed' },
      }),
    ).toThrow('requires version, date, and reference');
    expect(() =>
      workoutPlanV2Schema.parse({
        ...plan,
        policy: { ...plan.policy, reviewReference: 'fabricated-review' },
      }),
    ).toThrow('cannot carry review evidence');
  });

  it('has no clock, random-ID, network, database, or AI dependency in the pure planner', async () => {
    const source = await readFile(
      new URL('./workout-planner.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(
      /new Date\(|randomUUID|fetch\(|getDb|openai|anthropic|gemini/i,
    );
  });
});
