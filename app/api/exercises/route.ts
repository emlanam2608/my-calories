import { asc, eq } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { exerciseCatalog } from '@/db/schema';
import {
  ACTIVE_EXERCISE_CATALOG_VERSION,
  EXERCISE_CATALOG_CONTRACT_VERSION,
  catalogReviewStatus,
  exerciseCatalogResponseSchema,
  parseExerciseCatalogRow,
  validateExerciseCatalog,
} from '@/lib/exercise-catalog';

export async function GET() {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Sign in is required.' }, { status: 401 });
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
  let exercises;
  try {
    exercises = validateExerciseCatalog(rows.map(parseExerciseCatalogRow));
  } catch {
    return Response.json(
      { error: 'The exercise catalog is temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return Response.json(
    exerciseCatalogResponseSchema.parse({
      contractVersion: EXERCISE_CATALOG_CONTRACT_VERSION,
      catalogVersion: ACTIVE_EXERCISE_CATALOG_VERSION,
      reviewStatus: catalogReviewStatus(exercises),
      exercises,
    }),
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
