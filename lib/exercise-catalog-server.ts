import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { exerciseCatalog } from '@/db/schema';
import {
  ACTIVE_EXERCISE_CATALOG_VERSION,
  parseExerciseCatalogRow,
} from './exercise-catalog';

export async function activeExerciseCatalog() {
  const rows = await getDb()
    .select({
      id: exerciseCatalog.id,
      name: exerciseCatalog.name,
      category: exerciseCatalog.category,
      equipment: exerciseCatalog.equipment,
      environments: exerciseCatalog.environments,
      muscleGroups: exerciseCatalog.muscleGroups,
      contraindicationTags: exerciseCatalog.contraindicationTags,
      technique: exerciseCatalog.technique,
      regression: exerciseCatalog.regression,
      progression: exerciseCatalog.progression,
      substitutionIds: exerciseCatalog.substitutionIds,
      catalogVersion: exerciseCatalog.catalogVersion,
      reviewStatus: exerciseCatalog.reviewStatus,
      reviewedVersion: exerciseCatalog.reviewedVersion,
      reviewedAt: exerciseCatalog.reviewedAt,
      reviewReference: exerciseCatalog.reviewReference,
    })
    .from(exerciseCatalog)
    .where(eq(exerciseCatalog.catalogVersion, ACTIVE_EXERCISE_CATALOG_VERSION))
    .orderBy(asc(exerciseCatalog.category), asc(exerciseCatalog.id));
  return rows.map(parseExerciseCatalogRow);
}
