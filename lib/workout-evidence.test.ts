import { describe, expect, it } from 'vitest';
import { workoutPlanV2Schema } from './workout-planning-contracts';
import {
  validateExerciseResultsForSession,
  workoutEvidenceRequestSchema,
  workoutExerciseResultInputSchema,
} from './workout-evidence';

const plan = workoutPlanV2Schema.parse({
  planVersion: 'workout-plan-v2',
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
      progressionCriteriaCopyKeys: ['workoutPlanner.progression.recover'],
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
              reps: 8,
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

describe('workout exercise evidence', () => {
  it('accepts mixed completed, modified, and skipped evidence with approved substitutions', () => {
    const result = validateExerciseResultsForSession(
      plan,
      plan.sessions[0].id,
      [
        { exerciseId: 'warm', status: 'completed', actualDurationMinutes: 3 },
        {
          exerciseId: 'row',
          status: 'modified',
          actualSets: 2,
          actualReps: 7,
          actualLoad: 15.5,
          loadUnit: 'kg',
          substitutionId: 'wall-row',
        },
        { exerciseId: 'cool', status: 'skipped' },
      ],
    );
    expect(result).toMatchObject({ ok: true, adherenceStatus: 'partial' });
  });

  it('rejects duplicates, foreign exercises, and unapproved substitutions', () => {
    const base = {
      idempotencyKey: '018e2aaa-6a86-4d9d-b36a-a3d96fd00da1',
      planId: '018e2aaa-6a86-4d9d-b36a-a3d96fd00da2',
      sessionId: plan.sessions[0].id,
      durationMinutes: 20,
      rpe: 4,
      pain: false,
      concerningSymptoms: false,
    };
    expect(
      workoutEvidenceRequestSchema.safeParse({
        ...base,
        exerciseResults: [
          { exerciseId: 'warm', status: 'completed', actualDurationMinutes: 3 },
          { exerciseId: 'warm', status: 'skipped' },
        ],
      }).success,
    ).toBe(false);
    expect(
      validateExerciseResultsForSession(plan, plan.sessions[0].id, [
        { exerciseId: 'warm', status: 'completed', actualDurationMinutes: 3 },
        {
          exerciseId: 'foreign',
          status: 'completed',
          actualSets: 2,
          actualReps: 8,
        },
        { exerciseId: 'cool', status: 'completed', actualDurationMinutes: 3 },
      ]),
    ).toMatchObject({ ok: false });
    expect(
      validateExerciseResultsForSession(plan, plan.sessions[0].id, [
        { exerciseId: 'warm', status: 'completed', actualDurationMinutes: 3 },
        {
          exerciseId: 'row',
          status: 'modified',
          actualSets: 2,
          actualReps: 8,
          substitutionId: 'unknown',
        },
        { exerciseId: 'cool', status: 'completed', actualDurationMinutes: 3 },
      ]),
    ).toMatchObject({ ok: false });
  });

  it('bounds units and enforces duration versus set evidence', () => {
    expect(
      workoutExerciseResultInputSchema.safeParse({
        exerciseId: 'row',
        status: 'completed',
        actualSets: 2,
        actualReps: 8,
        actualLoad: 20,
        loadUnit: 'lb',
      }).success,
    ).toBe(true);
    expect(
      workoutExerciseResultInputSchema.safeParse({
        exerciseId: 'row',
        status: 'completed',
        actualSets: 2,
      }).success,
    ).toBe(false);
    expect(
      workoutExerciseResultInputSchema.safeParse({
        exerciseId: 'warm',
        status: 'skipped',
        actualDurationMinutes: 3,
      }).success,
    ).toBe(false);
    expect(
      workoutExerciseResultInputSchema.safeParse({
        exerciseId: 'row',
        status: 'completed',
        actualSets: 2,
        actualReps: 8,
        actualLoad: 20,
        loadUnit: 'stone',
      }).success,
    ).toBe(false);
  });

  it('accepts only positive values exactly representable by scaled integer storage', () => {
    const base = {
      idempotencyKey: '018e2aaa-6a86-4d9d-b36a-a3d96fd00da1',
      planId: '018e2aaa-6a86-4d9d-b36a-a3d96fd00da2',
      sessionId: plan.sessions[0].id,
      durationMinutes: 20,
      rpe: 4,
      pain: false,
      concerningSymptoms: false,
    };
    expect(
      workoutEvidenceRequestSchema.safeParse({
        ...base,
        preGlucose: 0.1,
        postGlucose: 5.4,
        load: 12.3,
        loadUnit: 'kg',
      }).success,
    ).toBe(true);
    for (const invalid of [
      { preGlucose: 0.04 },
      { postGlucose: 5.43 },
      { load: 12.34, loadUnit: 'kg' },
    ])
      expect(
        workoutEvidenceRequestSchema.safeParse({ ...base, ...invalid }).success,
      ).toBe(false);
    expect(
      workoutExerciseResultInputSchema.safeParse({
        exerciseId: 'row',
        status: 'completed',
        actualSets: 2,
        actualReps: 8,
        actualLoad: 0.04,
        loadUnit: 'kg',
      }).success,
    ).toBe(false);
  });
});
