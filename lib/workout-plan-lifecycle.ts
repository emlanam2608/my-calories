import { z } from 'zod';
import { workoutPlanSchema } from './contracts';
import {
  workoutPlanningContextSchema,
  workoutPlanV2Schema,
} from './workout-planning-contracts';

export const storedWorkoutPlanSchema = z.union([
  workoutPlanSchema,
  workoutPlanV2Schema,
]);

export const workoutPlanPreviewResponseSchema = z
  .object({
    previewId: z.string().uuid(),
    status: z.literal('preview'),
    expiresAt: z.string().datetime({ offset: true }),
    plan: workoutPlanV2Schema,
  })
  .strict();

export const confirmPersistedWorkoutPlanRequestSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    previewId: z.string().uuid(),
  })
  .strict();

export const activeWorkoutPlanSchema = z
  .object({
    id: z.string().uuid(),
    status: z.enum(['active', 'superseded']),
    plan: storedWorkoutPlanSchema,
    planningContext: workoutPlanningContextSchema.nullable(),
    confirmedAt: z.string().datetime({ offset: true }),
    supersededAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

export const workoutPlanMutationResponseSchema = z
  .object({
    plan: activeWorkoutPlanSchema,
    replayed: z.boolean(),
  })
  .strict();

export function parseStoredWorkoutPlan(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const version = (value as { planVersion?: unknown }).planVersion;
  if (version === 'starter-plan-1') {
    const parsed = workoutPlanSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }
  if (version === 'workout-plan-v2') {
    const parsed = workoutPlanV2Schema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }
  return null;
}

export type StoredWorkoutPlan = z.infer<typeof storedWorkoutPlanSchema>;
export type WorkoutPlanPreviewResponse = z.infer<
  typeof workoutPlanPreviewResponseSchema
>;
export type ActiveWorkoutPlan = z.infer<typeof activeWorkoutPlanSchema>;
