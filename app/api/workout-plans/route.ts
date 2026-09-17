import { and, desc, eq, inArray } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { requestDeduplications, workoutPlanPreviews, workoutPlans } from '@/db/schema';
import { ACTIVE_EXERCISE_CATALOG_VERSION } from '@/lib/exercise-catalog';
import { activeExerciseCatalog } from '@/lib/exercise-catalog-server';
import {
  activeWorkoutPlanSchema,
  confirmPersistedWorkoutPlanRequestSchema,
  parseStoredWorkoutPlan,
  workoutPlanMutationResponseSchema,
} from '@/lib/workout-plan-lifecycle';
import { workoutPlanningContextSchema, workoutPlanV2Schema } from '@/lib/workout-planning-contracts';
import { createDeterministicWorkoutPlan } from '@/lib/workout-planner';
import { resolveWorkoutPlanningContext } from '@/lib/workout-planning-context-server';

type PlanRow = typeof workoutPlans.$inferSelect;

function serializePlan(row: PlanRow) {
  const plan = parseStoredWorkoutPlan(row.plan);
  if (!plan) throw new Error(`Unsupported workout plan ${row.id}.`);
  return activeWorkoutPlanSchema.parse({
    id: row.id,
    status: row.status === 'superseded' ? 'superseded' : 'active',
    plan,
    planningContext: row.planningContext
      ? workoutPlanningContextSchema.parse(row.planningContext)
      : null,
    confirmedAt: row.confirmedAt.toISOString(),
    supersededAt: row.supersededAt?.toISOString() ?? null,
  });
}

async function planById(ownerId: string, id: string) {
  const rows = await getDb().select().from(workoutPlans).where(
    and(eq(workoutPlans.ownerId, ownerId), eq(workoutPlans.id, id)),
  ).limit(1);
  return rows[0] ? serializePlan(rows[0]) : null;
}

async function currentPlanForOwner(ownerId: string) {
  const rows = await getDb().select().from(workoutPlans).where(
    and(
      eq(workoutPlans.ownerId, ownerId),
      inArray(workoutPlans.status, ['active', 'confirmed']),
    ),
  ).orderBy(desc(workoutPlans.createdAt)).limit(1);
  return rows[0] ? serializePlan(rows[0]) : null;
}

function staleResponse() {
  return Response.json(
    {
      error: 'This workout preview is no longer current. Generate a new preview before confirming.',
      code: 'workout_plan_preview_stale',
    },
    { status: 409, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  return Response.json(
    { plan: await currentPlanForOwner(user.userId) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const parsed = confirmPersistedWorkoutPlanRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json({ error: 'Choose a valid saved preview before confirming.' }, { status: 400 });
  const db = getDb();
  const existing = await db.select().from(requestDeduplications).where(and(
    eq(requestDeduplications.ownerId, user.userId),
    eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey),
  )).limit(1);
  if (existing[0]) {
    if (existing[0].resourceType !== 'workout_plan')
      return Response.json({ error: 'This idempotency key has already been used for a different request.' }, { status: 409 });
    const replay = await planById(user.userId, existing[0].resourceId);
    if (!replay) return Response.json({ error: 'The original plan is unavailable.' }, { status: 410 });
    return Response.json(
      workoutPlanMutationResponseSchema.parse({ plan: replay, replayed: true }),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const previewRows = await db.select().from(workoutPlanPreviews).where(and(
    eq(workoutPlanPreviews.id, parsed.data.previewId),
    eq(workoutPlanPreviews.ownerId, user.userId),
  )).limit(1);
  const preview = previewRows[0];
  if (!preview) return Response.json({ error: 'Workout preview not found.' }, { status: 404 });
  const now = new Date();
  if (preview.status !== 'preview') return staleResponse();
  if (preview.expiresAt.getTime() <= now.getTime()) {
    await db.update(workoutPlanPreviews).set({ status: 'expired' }).where(and(
      eq(workoutPlanPreviews.id, preview.id),
      eq(workoutPlanPreviews.ownerId, user.userId),
      eq(workoutPlanPreviews.status, 'preview'),
    ));
    return staleResponse();
  }
  const storedContext = workoutPlanningContextSchema.safeParse(preview.planningContext);
  const storedPlan = workoutPlanV2Schema.safeParse(preview.plan);
  if (!storedContext.success || !storedPlan.success) return staleResponse();
  if (storedPlan.data.draftStatus !== 'complete')
    return Response.json({ error: 'Resolve the preview questions before confirming this plan.' }, { status: 422 });

  let verification:
    | {
        context: typeof storedContext.data;
        rebuilt: ReturnType<typeof createDeterministicWorkoutPlan>;
      }
    | undefined;
  try {
    const resolved = await resolveWorkoutPlanningContext(user.userId, now);
    if (resolved.status !== 'ready') return staleResponse();
    verification = {
      context: resolved.context,
      rebuilt: createDeterministicWorkoutPlan(
        resolved.context,
        await activeExerciseCatalog(),
      ),
    };
  } catch {
    return staleResponse();
  }
  const rebuilt = verification.rebuilt;
  if (
    verification.context.inputDigest !== preview.planningContextDigest ||
    preview.catalogVersion !== ACTIVE_EXERCISE_CATALOG_VERSION ||
    rebuilt.status !== 'draft' ||
    JSON.stringify(rebuilt.plan) !== JSON.stringify(storedPlan.data)
  ) return staleResponse();

  const id = crypto.randomUUID();
  try {
    await db.batch([
      db.update(workoutPlans).set({ status: 'superseded', supersededAt: now }).where(and(
        eq(workoutPlans.ownerId, user.userId),
        inArray(workoutPlans.status, ['active', 'confirmed']),
      )),
      db.insert(workoutPlans).values({
        id,
        ownerId: user.userId,
        planVersion: storedPlan.data.planVersion,
        periodStart: storedPlan.data.periodStart,
        status: 'active',
        plan: storedPlan.data,
        planningContext: storedContext.data,
        planningContextDigest: preview.planningContextDigest,
        catalogVersion: preview.catalogVersion,
        sourcePreviewId: preview.id,
        createdAt: now,
        confirmedAt: now,
      }),
      db.update(workoutPlanPreviews).set({ status: 'active', activatedPlanId: id, activatedAt: now }).where(and(
        eq(workoutPlanPreviews.id, preview.id),
        eq(workoutPlanPreviews.ownerId, user.userId),
        eq(workoutPlanPreviews.status, 'preview'),
      )),
      db.insert(requestDeduplications).values({
        id: crypto.randomUUID(), ownerId: user.userId,
        idempotencyKey: parsed.data.idempotencyKey,
        resourceType: 'workout_plan', resourceId: id, createdAt: now,
      }),
    ]);
  } catch {
    const dedup = await db.select().from(requestDeduplications).where(and(
      eq(requestDeduplications.ownerId, user.userId),
      eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey),
    )).limit(1);
    if (dedup[0]?.resourceType === 'workout_plan') {
      const replay = await planById(user.userId, dedup[0].resourceId);
      if (replay)
        return Response.json(workoutPlanMutationResponseSchema.parse({ plan: replay, replayed: true }), { headers: { 'Cache-Control': 'no-store' } });
    }
    return staleResponse();
  }
  const activated = await planById(user.userId, id);
  return Response.json(
    workoutPlanMutationResponseSchema.parse({ plan: activated, replayed: false }),
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
