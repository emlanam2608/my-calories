import { z } from 'zod';

export const exerciseCatalogEntrySchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.object({ en: z.string().trim().min(1), vi: z.string().trim().min(1) }),
  category: z.enum(['mobility', 'strength', 'aerobic']),
  equipment: z.array(z.string().trim().min(1)).min(1),
  muscleGroups: z.array(z.string().trim().min(1)).min(1),
  contraindicationTags: z.array(z.string().trim().min(1)),
  technique: z.object({ en: z.string().trim().min(1), vi: z.string().trim().min(1) }),
  regression: z.object({ en: z.string().trim().min(1), vi: z.string().trim().min(1) }),
  progression: z.object({ en: z.string().trim().min(1), vi: z.string().trim().min(1) }),
  substitutionIds: z.array(z.string().trim().min(1)),
});

export const exerciseCatalogResponseSchema = z.object({
  exercises: z.array(exerciseCatalogEntrySchema),
});

export type ExerciseCatalogEntry = z.infer<typeof exerciseCatalogEntrySchema>;

export function parseExerciseCatalogRow(row: {
  id: string;
  name: unknown;
  category: string;
  equipment: unknown;
  muscleGroups: unknown;
  contraindicationTags: unknown;
  technique: unknown;
  regression: unknown;
  progression: unknown;
  substitutionIds: unknown;
}) {
  return exerciseCatalogEntrySchema.parse(row);
}
