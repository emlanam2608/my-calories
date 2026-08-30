import { asc, eq } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { exerciseCatalog } from '@/db/schema';
import {
  exerciseCatalogResponseSchema,
  parseExerciseCatalogRow,
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
      muscleGroups: exerciseCatalog.muscleGroups,
      contraindicationTags: exerciseCatalog.contraindicationTags,
      technique: exerciseCatalog.technique,
      regression: exerciseCatalog.regression,
      progression: exerciseCatalog.progression,
      substitutionIds: exerciseCatalog.substitutionIds,
    })
    .from(exerciseCatalog)
    .where(eq(exerciseCatalog.catalogVersion, 'starter-1'))
    .orderBy(asc(exerciseCatalog.category), asc(exerciseCatalog.id));
  return Response.json(
    exerciseCatalogResponseSchema.parse({
      exercises: rows.map(parseExerciseCatalogRow),
    }),
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
