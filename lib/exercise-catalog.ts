import { z } from 'zod';
import { workoutEnvironmentSchema } from './contracts';

export const EXERCISE_CATALOG_CONTRACT_VERSION =
  'exercise-catalog-contract-2' as const;
export const ACTIVE_EXERCISE_CATALOG_VERSION = 'starter-2' as const;

export const exerciseCapabilitySchema = z.enum([
  'bodyweight',
  'wall',
  'chair',
  'exercise_mat',
  'bicycle',
  'mini_treadmill',
  'resistance_band',
  'band_anchor',
  'dumbbells',
  'gym',
  'cable_machine',
]);

export const exerciseContraindicationTagSchema = z.enum([
  'back_pain',
  'knee_pain',
  'hip_pain',
  'wrist_pain',
  'shoulder_pain',
  'balance_risk',
]);

export const exerciseReviewStatusSchema = z.enum([
  'unreviewed',
  'professionally_reviewed',
]);

const bilingualTextSchema = z.object({
  en: z.string().trim().min(1),
  vi: z.string().trim().min(1),
});

const reviewMetadataSchema = z
  .object({
    reviewStatus: exerciseReviewStatusSchema,
    reviewedVersion: z.string().trim().min(1).max(80).nullable(),
    reviewedAt: z.string().date().nullable(),
    reviewReference: z.string().trim().min(1).max(300).nullable(),
  })
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
          'Professionally reviewed catalog entries require version, date, and reference evidence.',
      });
    if (
      value.reviewStatus === 'unreviewed' &&
      evidence.some((item) => item !== null)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Unreviewed catalog entries cannot carry professional review evidence.',
      });
  });

export const exerciseCatalogEntrySchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    name: bilingualTextSchema,
    category: z.enum(['mobility', 'strength', 'aerobic']),
    requiredCapabilities: z.array(exerciseCapabilitySchema).min(1),
    environments: z.array(workoutEnvironmentSchema).min(1),
    muscleGroups: z.array(z.string().trim().min(1)).min(1),
    contraindicationTags: z.array(exerciseContraindicationTagSchema),
    technique: bilingualTextSchema,
    regression: bilingualTextSchema,
    progression: bilingualTextSchema,
    substitutionIds: z.array(z.string().trim().min(1).max(80)),
    catalogVersion: z.literal(ACTIVE_EXERCISE_CATALOG_VERSION),
  })
  .superRefine((value, context) => {
    for (const key of [
      'requiredCapabilities',
      'environments',
      'muscleGroups',
      'contraindicationTags',
      'substitutionIds',
    ] as const) {
      if (new Set(value[key]).size !== value[key].length)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `Exercise catalog ${key} values must be unique.`,
        });
    }
  })
  .and(reviewMetadataSchema);

export const exerciseCatalogResponseSchema = z.object({
  contractVersion: z.literal(EXERCISE_CATALOG_CONTRACT_VERSION),
  catalogVersion: z.literal(ACTIVE_EXERCISE_CATALOG_VERSION),
  reviewStatus: exerciseReviewStatusSchema,
  exercises: z.array(exerciseCatalogEntrySchema),
});

export type ExerciseCapability = z.infer<typeof exerciseCapabilitySchema>;
export type ExerciseCatalogEntry = z.infer<typeof exerciseCatalogEntrySchema>;
export type ExerciseReviewStatus = z.infer<typeof exerciseReviewStatusSchema>;

export type ExerciseCatalogRow = {
  id: string;
  name: unknown;
  category: string;
  equipment: unknown;
  environments: unknown;
  muscleGroups: unknown;
  contraindicationTags: unknown;
  technique: unknown;
  regression: unknown;
  progression: unknown;
  substitutionIds: unknown;
  catalogVersion: string;
  reviewStatus: string;
  reviewedVersion: string | null;
  reviewedAt: string | null;
  reviewReference: string | null;
};

export function parseExerciseCatalogRow(row: ExerciseCatalogRow) {
  return exerciseCatalogEntrySchema.parse({
    ...row,
    requiredCapabilities: row.equipment,
  });
}

export function validateExerciseCatalog(entries: ExerciseCatalogEntry[]) {
  const parsed = entries.map((entry) =>
    exerciseCatalogEntrySchema.parse(entry),
  );
  const ids = new Set<string>();
  for (const entry of parsed) {
    if (ids.has(entry.id))
      throw new Error(`Duplicate exercise catalog ID: ${entry.id}`);
    ids.add(entry.id);
  }
  for (const entry of parsed) {
    for (const substitutionId of entry.substitutionIds) {
      if (substitutionId === entry.id)
        throw new Error(`Exercise ${entry.id} cannot substitute itself.`);
      if (!ids.has(substitutionId))
        throw new Error(
          `Exercise ${entry.id} has dangling substitution ${substitutionId}.`,
        );
    }
  }
  return [...parsed].sort(
    (left, right) =>
      left.category.localeCompare(right.category) ||
      left.id.localeCompare(right.id),
  );
}

export function catalogReviewStatus(
  entries: ExerciseCatalogEntry[],
): ExerciseReviewStatus {
  return entries.length > 0 &&
    entries.every((entry) => entry.reviewStatus === 'professionally_reviewed')
    ? 'professionally_reviewed'
    : 'unreviewed';
}
