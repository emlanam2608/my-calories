import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { workoutPlanPreviews } from '@/db/schema';
import { ACTIVE_EXERCISE_CATALOG_VERSION } from '@/lib/exercise-catalog';
import { activeExerciseCatalog } from '@/lib/exercise-catalog-server';
import { workoutPlanPreviewResponseSchema } from '@/lib/workout-plan-lifecycle';
import { createDeterministicWorkoutPlan } from '@/lib/workout-planner';
import { resolveWorkoutPlanningContext } from '@/lib/workout-planning-context-server';
import { recommendationBlockedResponse } from '@/lib/safety-enforcement';

const PREVIEW_TTL_MS = 30 * 60 * 1_000;

export async function POST() {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const now = new Date();
  const resolved = await resolveWorkoutPlanningContext(user.userId, now);
  if (resolved.safetyContext.decisions.workout_plan.status === 'blocked')
    return recommendationBlockedResponse(resolved.safetyContext, 'workout_plan');
  if (resolved.status !== 'ready')
    return Response.json(
      { error: 'Complete your profile setup before generating a plan.' },
      { status: 422 },
    );
  try {
    const result = createDeterministicWorkoutPlan(
      resolved.context,
      await activeExerciseCatalog(),
    );
    if (result.status === 'blocked')
      return recommendationBlockedResponse(resolved.safetyContext, 'workout_plan');
    const id = crypto.randomUUID();
    const expiresAt = new Date(now.getTime() + PREVIEW_TTL_MS);
    await getDb().insert(workoutPlanPreviews).values({
      id,
      ownerId: user.userId,
      status: 'preview',
      planningContext: resolved.context,
      planningContextDigest: resolved.context.inputDigest,
      catalogVersion: ACTIVE_EXERCISE_CATALOG_VERSION,
      plan: result.plan,
      expiresAt,
      createdAt: now,
    });
    return Response.json(
      workoutPlanPreviewResponseSchema.parse({
        previewId: id,
        status: 'preview',
        expiresAt: expiresAt.toISOString(),
        plan: result.plan,
      }),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json(
      { error: 'The exercise catalog is not ready. Please try again later.' },
      { status: 503 },
    );
  }
}
