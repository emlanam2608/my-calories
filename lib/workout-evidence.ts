import { z } from 'zod';
import { workoutCheckinSchema } from './contracts';
import type { WorkoutPlanV2 } from './workout-planning-contracts';

export const WORKOUT_EVIDENCE_VERSION = 'workout-exercise-evidence-1' as const;

const oneDecimalPositive = (maximum: number) =>
  z
    .number()
    .finite()
    .min(0.1)
    .max(maximum)
    .refine(
      (value) => Math.abs(value * 10 - Math.round(value * 10)) < 1e-9,
      'Use at most one decimal place.',
    );

const workoutExerciseResultFields = {
  exerciseId: z.string().trim().min(1).max(80),
  status: z.enum(['completed', 'modified', 'skipped']),
  actualSets: z.number().int().min(1).max(100).optional(),
  actualReps: z.number().int().min(1).max(1_000).optional(),
  actualDurationMinutes: z.number().int().min(1).max(300).optional(),
  actualLoad: oneDecimalPositive(5_000).optional(),
  loadUnit: z.enum(['kg', 'lb']).optional(),
  substitutionId: z.string().trim().min(1).max(80).optional(),
};

export const workoutExerciseResultInputSchema = z
  .object(workoutExerciseResultFields)
  .strict()
  .superRefine((value, context) => {
    if ((value.actualSets === undefined) !== (value.actualReps === undefined))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['actualSets'],
        message: 'Actual sets and reps must be recorded together.',
      });
    if ((value.actualLoad === undefined) !== (value.loadUnit === undefined))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['actualLoad'],
        message: 'Actual load and unit must be recorded together.',
      });
    const hasDose =
      value.actualSets !== undefined ||
      value.actualDurationMinutes !== undefined;
    if (
      value.status === 'skipped' &&
      (hasDose || value.actualLoad !== undefined)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Skipped exercises cannot contain completed dose evidence.',
      });
    if (value.status !== 'skipped' && !hasDose)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Completed or modified exercises require an actual dose.',
      });
    if (value.status !== 'modified' && value.substitutionId !== undefined)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['substitutionId'],
        message: 'Only a modified exercise can record a substitution.',
      });
  });

export const workoutEvidenceRequestSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    planId: z.string().uuid(),
    sessionId: z.string().trim().min(1).max(80),
    durationMinutes: z.number().int().min(1).max(300),
    rpe: z.number().int().min(1).max(10),
    enjoyment: z.number().int().min(1).max(5).optional(),
    setsCompleted: z.number().int().min(1).max(100).optional(),
    repsPerSet: z.number().int().min(1).max(1_000).optional(),
    load: oneDecimalPositive(5_000).optional(),
    loadUnit: z.enum(['kg', 'lb']).optional(),
    averageHeartRate: z.number().int().min(20).max(260).optional(),
    pain: z.boolean(),
    concerningSymptoms: z.boolean(),
    preGlucose: oneDecimalPositive(40).optional(),
    postGlucose: oneDecimalPositive(40).optional(),
    exerciseResults: z
      .array(workoutExerciseResultInputSchema)
      .max(20)
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.setsCompleted === undefined) !==
      (value.repsPerSet === undefined)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter both aggregate sets and reps.',
      });
    if ((value.load === undefined) !== (value.loadUnit === undefined))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter aggregate load and unit together.',
      });
    const ids = value.exerciseResults?.map((result) => result.exerciseId) ?? [];
    if (new Set(ids).size !== ids.length)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['exerciseResults'],
        message: 'Each planned exercise can be recorded once.',
      });
  });

export const workoutExerciseResultSchema = z
  .object({
    id: z.string().uuid(),
    ...workoutExerciseResultFields,
  })
  .strict();

export const workoutEvidenceLogSchema = z
  .object({
    id: z.string().uuid(),
    planId: z.string().uuid(),
    sessionId: z.string().trim().min(1).max(80),
    status: z.enum(['completed', 'stopped_for_safety']),
    durationMinutes: z.number().int().min(1),
    rpe: z.number().int().min(1).max(10),
    enjoyment: z.number().int().min(1).max(5).nullable(),
    setsCompleted: z.number().int().min(1).nullable(),
    repsPerSet: z.number().int().min(1).nullable(),
    load: oneDecimalPositive(5_000).nullable(),
    loadUnit: z.enum(['kg', 'lb']).nullable(),
    averageHeartRate: z.number().int().min(20).max(260).nullable(),
    pain: z.boolean(),
    concerningSymptoms: z.boolean(),
    preGlucose: oneDecimalPositive(40).nullable(),
    postGlucose: oneDecimalPositive(40).nullable(),
    completedAt: z.string().datetime({ offset: true }),
    requiresReview: z.boolean(),
    evidenceVersion: z.enum(['legacy-aggregate-1', WORKOUT_EVIDENCE_VERSION]),
    dataCompleteness: z.enum(['legacy_aggregate', 'exercise_level_complete']),
    adherenceStatus: z.enum([
      'legacy_unknown',
      'complete',
      'partial',
      'not_counted_safety_stop',
    ]),
    exerciseResults: z.array(workoutExerciseResultSchema),
  })
  .strict();

export const workoutRecoveryInputSchema = z
  .object({
    status: z.enum(['good', 'some_fatigue', 'poor']),
    soreness: z.boolean().optional(),
    pain: z.boolean().optional(),
  })
  .strict();

export const workoutEvidenceCheckinRequestSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    planId: z.string().uuid(),
    recovery: workoutRecoveryInputSchema.optional(),
  })
  .strict();

export const workoutEvidenceCheckinSchema = workoutCheckinSchema
  .extend({
    recovery: workoutRecoveryInputSchema.nullable(),
    dataCompleteness: z.enum(['legacy_no_recovery', 'structured_recovery']),
  })
  .strict();

export function validateExerciseResultsForSession(
  plan: WorkoutPlanV2,
  sessionId: string,
  results: z.infer<typeof workoutExerciseResultInputSchema>[] | undefined,
) {
  const session = plan.sessions.find((candidate) => candidate.id === sessionId);
  if (!session)
    return {
      ok: false as const,
      error: 'The session is not in this workout plan.',
    };
  if (!results)
    return {
      ok: false as const,
      error: 'Exercise-level results are required for this plan version.',
    };
  const prescriptions = new Map(
    session.sections
      .flatMap((section) => section.prescriptions)
      .map((item) => [item.exerciseId, item]),
  );
  if (results.length !== prescriptions.size)
    return {
      ok: false as const,
      error: 'Record every planned exercise exactly once.',
    };
  for (const result of results) {
    const prescription = prescriptions.get(result.exerciseId);
    if (!prescription)
      return {
        ok: false as const,
        error: 'A result references an exercise outside the immutable plan.',
      };
    if (
      result.substitutionId &&
      !prescription.substitutionIds.includes(result.substitutionId)
    )
      return {
        ok: false as const,
        error: 'The substitution is not approved for this planned exercise.',
      };
    if (
      prescription.sets !== null &&
      result.status !== 'skipped' &&
      result.actualSets === undefined
    )
      return {
        ok: false as const,
        error: 'Record actual sets and reps for a set-based exercise.',
      };
    if (
      prescription.durationMinutes !== null &&
      result.status !== 'skipped' &&
      result.actualDurationMinutes === undefined
    )
      return {
        ok: false as const,
        error: 'Record actual duration for a duration-based exercise.',
      };
  }
  const adherenceStatus = results.every(
    (result) => result.status === 'completed',
  )
    ? ('complete' as const)
    : ('partial' as const);
  return { ok: true as const, session, adherenceStatus };
}

export type WorkoutEvidenceRequest = z.infer<
  typeof workoutEvidenceRequestSchema
>;
export type WorkoutExerciseResult = z.infer<typeof workoutExerciseResultSchema>;
export type WorkoutEvidenceLog = z.infer<typeof workoutEvidenceLogSchema>;
export type WorkoutRecoveryInput = z.infer<typeof workoutRecoveryInputSchema>;
export type WorkoutEvidenceCheckin = z.infer<
  typeof workoutEvidenceCheckinSchema
>;
