import { z } from 'zod';
import {
  clinicianRestrictionFlagSchema,
  onboardingGoalSchema,
  safetyDecisionStatusSchema,
  safetyReasonCodeSchema,
  workoutEnvironmentSchema,
  workoutInjuryFlagSchema,
} from './contracts';
import {
  exerciseCapabilitySchema,
  exerciseReviewStatusSchema,
} from './exercise-catalog';

export const WORKOUT_PLANNING_CONTEXT_VERSION =
  'workout-planning-context-1' as const;
export const WORKOUT_PLAN_V2_VERSION = 'workout-plan-v2' as const;
export const WORKOUT_PLANNER_VERSION =
  'deterministic-weekly-planner-1' as const;

const daySchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
const sourceSchema = z
  .object({
    kind: z.enum([
      'onboarding',
      'safety_context',
      'workout_plan',
      'workout_log',
    ]),
    recordId: z.string().trim().min(1).max(100),
    recordedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const workoutRecoverySummarySchema = z
  .object({
    windowDays: z.number().int().min(7).max(42),
    plannedSessions: z.number().int().min(0).max(42),
    completedSessions: z.number().int().min(0).max(42),
    stoppedForSafety: z.number().int().min(0).max(42),
    painReported: z.boolean(),
    concerningSymptomsReported: z.boolean(),
    averageRpe: z.number().min(1).max(10).nullable(),
    dataCompleteness: z.enum(['none', 'partial', 'complete']),
    sourceRecordIds: z.array(z.string().trim().min(1).max(100)).max(42),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.completedSessions > value.plannedSessions)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['completedSessions'],
        message: 'Completed sessions cannot exceed planned sessions.',
      });
    if (value.stoppedForSafety > value.completedSessions)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stoppedForSafety'],
        message: 'Safety-stopped sessions cannot exceed completed sessions.',
      });
    if (new Set(value.sourceRecordIds).size !== value.sourceRecordIds.length)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceRecordIds'],
        message: 'Recovery evidence record IDs must be unique.',
      });
  });

export const workoutPlanningContextSchema = z
  .object({
    contextVersion: z.literal(WORKOUT_PLANNING_CONTEXT_VERSION),
    planningDate: z.string().date(),
    timezone: z.literal('Asia/Bangkok'),
    goal: onboardingGoalSchema,
    trainingHistory: z.enum(['new_to_exercise', 'beginner', 'regular']),
    availableDays: z.array(daySchema).max(7),
    equipmentCapabilities: z.array(exerciseCapabilitySchema).max(11),
    environments: z.array(workoutEnvironmentSchema).max(3),
    injuryFlags: z.array(workoutInjuryFlagSchema).max(3),
    clinicianRestrictionFlags: z.array(clinicianRestrictionFlagSchema).max(4),
    safety: z
      .object({
        contextVersion: z.string().trim().min(1).max(80),
        decision: safetyDecisionStatusSchema,
        reasonCodes: z.array(safetyReasonCodeSchema).max(25),
      })
      .strict()
      .superRefine((value, context) => {
        if (value.decision === 'blocked' && value.reasonCodes.length === 0)
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['reasonCodes'],
            message: 'A blocked planning context requires a safety reason.',
          });
      }),
    currentPlan: z
      .object({
        id: z.string().trim().min(1).max(100),
        planVersion: z.string().trim().min(1).max(80),
      })
      .strict()
      .nullable(),
    recovery: workoutRecoverySummarySchema,
    sources: z.array(sourceSchema).min(1).max(46),
    inputDigest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()
  .superRefine((value, context) => {
    for (const key of [
      'availableDays',
      'equipmentCapabilities',
      'environments',
      'injuryFlags',
      'clinicianRestrictionFlags',
    ] as const) {
      if (new Set(value[key]).size !== value[key].length)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `Planning context ${key} values must be unique.`,
        });
    }
    const sourceKeys = value.sources.map(
      (source) => `${source.kind}:${source.recordId}`,
    );
    if (new Set(sourceKeys).size !== sourceKeys.length)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sources'],
        message: 'Planning context sources must be unique.',
      });
  });

const plannerCopyKeySchema = z
  .string()
  .regex(/^workoutPlanner\.[a-z][a-zA-Z0-9._]+$/);

export const workoutPlanV2PrescriptionSchema = z
  .object({
    exerciseId: z.string().trim().min(1).max(80),
    allocatedMinutes: z.number().int().min(1).max(60),
    sets: z.number().int().min(1).max(6).nullable(),
    reps: z.number().int().min(1).max(30).nullable(),
    durationMinutes: z.number().int().min(1).max(60).nullable(),
    restSeconds: z.number().int().min(0).max(180).nullable(),
    targetRpe: z.number().int().min(1).max(7),
    rationaleCopyKey: plannerCopyKeySchema,
    substitutionIds: z.array(z.string().trim().min(1).max(80)).max(8),
    modificationReasonCodes: z.array(z.string().trim().min(1).max(80)).max(8),
  })
  .strict()
  .superRefine((value, context) => {
    const hasStrengthDose = value.sets !== null || value.reps !== null;
    if ((value.sets === null) !== (value.reps === null))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Sets and reps must be present or absent together.',
      });
    if (hasStrengthDose === (value.durationMinutes !== null))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Use either sets/reps or duration for a prescription.',
      });
  });

const planSectionSchema = z
  .object({
    phase: z.enum(['warmup', 'strength', 'aerobic', 'mobility', 'cooldown']),
    prescriptions: z.array(workoutPlanV2PrescriptionSchema).min(1).max(4),
  })
  .strict();

const unresolvedQuestionSchema = z
  .object({
    code: z.enum([
      'no_available_day',
      'missing_environment',
      'missing_mobility_candidate',
      'missing_strength_candidate',
      'missing_aerobic_candidate',
      'unresolved_substitution',
    ]),
    copyKey: plannerCopyKeySchema,
    exerciseIds: z.array(z.string().trim().min(1).max(80)).max(8),
    missingCapabilities: z.array(exerciseCapabilitySchema).max(11),
  })
  .strict();

const workoutPlanV2SessionSchema = z
  .object({
    id: z.string().regex(/^v2-[a-z0-9-]+$/),
    day: daySchema,
    date: z.string().date(),
    purpose: z.enum(['strength', 'aerobic', 'mobility']),
    titleCopyKey: plannerCopyKeySchema,
    rationaleCopyKeys: z.array(plannerCopyKeySchema).min(1).max(4),
    durationMinutes: z.number().int().min(10).max(60),
    targetRpe: z.number().int().min(1).max(7),
    sections: z.array(planSectionSchema).min(3).max(5),
    progressionCriteriaCopyKeys: z.array(plannerCopyKeySchema).min(1).max(4),
  })
  .strict()
  .superRefine((session, context) => {
    const allocated = session.sections
      .flatMap((section) => section.prescriptions)
      .reduce(
        (total, prescription) => total + prescription.allocatedMinutes,
        0,
      );
    if (allocated > session.durationMinutes)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['durationMinutes'],
        message: 'Prescription time cannot exceed session duration.',
      });
    if (session.sections[0]?.phase !== 'warmup')
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sections'],
        message: 'A workout session must start with warm-up.',
      });
    if (session.sections.at(-1)?.phase !== 'cooldown')
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sections'],
        message: 'A workout session must end with cooldown.',
      });
  });

export const workoutPlanV2Schema = z
  .object({
    planVersion: z.literal(WORKOUT_PLAN_V2_VERSION),
    plannerVersion: z.literal(WORKOUT_PLANNER_VERSION),
    catalogVersion: z.string().trim().min(1).max(80),
    catalogReviewStatus: exerciseReviewStatusSchema,
    policy: z
      .object({
        version: z.string().trim().min(1).max(80),
        reviewStatus: exerciseReviewStatusSchema,
        reviewedVersion: z.string().trim().min(1).max(80).nullable(),
        reviewedAt: z.string().date().nullable(),
        reviewReference: z.string().trim().min(1).max(300).nullable(),
      })
      .strict()
      .superRefine((value, context) => {
        const evidence = [
          value.reviewedVersion,
          value.reviewedAt,
          value.reviewReference,
        ];
        if (
          value.reviewStatus === 'professionally_reviewed' &&
          evidence.some((item) => item === null)
        )
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'A professionally reviewed policy requires version, date, and reference evidence.',
          });
        if (
          value.reviewStatus === 'unreviewed' &&
          evidence.some((item) => item !== null)
        )
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'An unreviewed policy cannot carry review evidence.',
          });
      }),
    safetyContextVersion: z.string().trim().min(1).max(80),
    inputDigest: z.string().regex(/^[a-f0-9]{64}$/),
    periodStart: z.string().date(),
    timezone: z.literal('Asia/Bangkok'),
    draftStatus: z.enum(['complete', 'incomplete']),
    sessions: z.array(workoutPlanV2SessionSchema).max(7),
    appliedSafetyReasonCodes: z.array(safetyReasonCodeSchema).max(25),
    unresolvedQuestions: z.array(unresolvedQuestionSchema).max(20),
  })
  .strict()
  .superRefine((plan, context) => {
    if (plan.draftStatus === 'complete' && plan.sessions.length === 0)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sessions'],
        message: 'A complete plan requires at least one session.',
      });
    if (plan.draftStatus === 'complete' && plan.unresolvedQuestions.length > 0)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['unresolvedQuestions'],
        message: 'A complete plan cannot have unresolved questions.',
      });
    if (
      plan.draftStatus === 'incomplete' &&
      plan.unresolvedQuestions.length === 0
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['unresolvedQuestions'],
        message: 'An incomplete plan must explain what remains unresolved.',
      });
    const sessionIds = plan.sessions.map((session) => session.id);
    const sessionDates = plan.sessions.map((session) => session.date);
    if (
      new Set(sessionIds).size !== sessionIds.length ||
      new Set(sessionDates).size !== sessionDates.length
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sessions'],
        message: 'Session IDs and dates must be unique.',
      });
  });

export const workoutPlannerResultSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('blocked'),
      plan: z.null(),
      reasonCodes: z.array(safetyReasonCodeSchema).min(1).max(25),
    })
    .strict(),
  z
    .object({
      status: z.literal('draft'),
      plan: workoutPlanV2Schema,
      reasonCodes: z.array(safetyReasonCodeSchema).max(25),
    })
    .strict(),
]);

export type WorkoutRecoverySummary = z.infer<
  typeof workoutRecoverySummarySchema
>;
export type WorkoutPlanningContext = z.infer<
  typeof workoutPlanningContextSchema
>;
export type WorkoutPlanV2 = z.infer<typeof workoutPlanV2Schema>;
export type WorkoutPlanV2Prescription = z.infer<
  typeof workoutPlanV2PrescriptionSchema
>;
export type WorkoutPlannerResult = z.infer<typeof workoutPlannerResultSchema>;
