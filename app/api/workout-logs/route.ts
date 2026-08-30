import { and, desc, eq } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { requestDeduplications, workoutPlans, workoutSessions } from '@/db/schema';
import {
  workoutLogRequestSchema,
  workoutLogSchema,
  workoutLogsResponseSchema,
  workoutPlanSchema,
} from '@/lib/contracts';

function toLog(row: typeof workoutSessions.$inferSelect) {
  return workoutLogSchema.parse({
    id: row.id,
    planId: row.planId,
    sessionId: row.sessionId,
    status: row.status,
    durationMinutes: row.durationMinutes,
    rpe: row.rpe,
    enjoyment: row.enjoyment,
    setsCompleted: row.setsCompleted,
    repsPerSet: row.repsPerSet,
    load: row.loadScaled === null ? null : row.loadScaled / row.loadScale,
    loadUnit: row.loadUnit,
    averageHeartRate: row.averageHeartRate,
    pain: row.pain,
    concerningSymptoms: row.concerningSymptoms,
    preGlucose:
      row.preGlucoseScaled === null ? null : row.preGlucoseScaled / row.glucoseScale,
    postGlucose:
      row.postGlucoseScaled === null ? null : row.postGlucoseScaled / row.glucoseScale,
    completedAt: row.completedAt?.toISOString(),
    requiresReview: row.pain || row.concerningSymptoms,
  });
}

async function logsForOwner(ownerId: string) {
  const rows = await getDb()
    .select()
    .from(workoutSessions)
    .where(eq(workoutSessions.ownerId, ownerId))
    .orderBy(desc(workoutSessions.completedAt))
    .limit(30);
  return workoutLogsResponseSchema.parse({
    logs: rows
      .filter((row) => row.planId && row.sessionId && row.completedAt)
      .map(toLog),
  });
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  return Response.json(await logsForOwner(user.userId), {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const parsed = workoutLogRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json({ error: 'Review the workout-log fields and try again.' }, { status: 400 });

  const planRow = await getDb()
    .select({ plan: workoutPlans.plan, planVersion: workoutPlans.planVersion })
    .from(workoutPlans)
    .where(
      and(
        eq(workoutPlans.id, parsed.data.planId),
        eq(workoutPlans.ownerId, user.userId),
        eq(workoutPlans.status, 'confirmed'),
      ),
    )
    .limit(1);
  const plan = planRow[0] ? workoutPlanSchema.safeParse(planRow[0].plan) : null;
  if (!plan?.success || !plan.data.sessions.some((session) => session.id === parsed.data.sessionId))
    return Response.json({ error: 'This session is not in one of your confirmed workout plans.' }, { status: 404 });

  const db = getDb();
  const existing = await db
    .select({ resourceType: requestDeduplications.resourceType })
    .from(requestDeduplications)
    .where(
      and(
        eq(requestDeduplications.ownerId, user.userId),
        eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey),
      ),
    )
    .limit(1);
  if (existing[0]) {
    if (existing[0].resourceType !== 'workout_log')
      return Response.json(
        { error: 'This idempotency key has already been used for a different request.' },
        { status: 409 },
      );
    return Response.json(
      { ...(await logsForOwner(user.userId)), replayed: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const now = new Date();
  const id = crypto.randomUUID();
  const requiresReview = parsed.data.pain || parsed.data.concerningSymptoms;
  try {
    await db.batch([
      db.insert(workoutSessions).values({
        id,
        ownerId: user.userId,
        planId: parsed.data.planId,
        sessionId: parsed.data.sessionId,
        planVersion: planRow[0].planVersion,
        status: requiresReview ? 'stopped_for_safety' : 'completed',
        durationMinutes: parsed.data.durationMinutes,
        rpe: parsed.data.rpe,
        enjoyment: parsed.data.enjoyment ?? null,
        setsCompleted: parsed.data.setsCompleted ?? null,
        repsPerSet: parsed.data.repsPerSet ?? null,
        loadScaled:
          parsed.data.load === undefined ? null : Math.round(parsed.data.load * 10),
        loadScale: 10,
        loadUnit: parsed.data.loadUnit ?? null,
        averageHeartRate: parsed.data.averageHeartRate ?? null,
        pain: parsed.data.pain,
        concerningSymptoms: parsed.data.concerningSymptoms,
        preGlucoseScaled:
          parsed.data.preGlucose === undefined
            ? null
            : Math.round(parsed.data.preGlucose * 10),
        postGlucoseScaled:
          parsed.data.postGlucose === undefined
            ? null
            : Math.round(parsed.data.postGlucose * 10),
        glucoseScale: 10,
        safetyNotes: null,
        completedAt: now,
      }),
      db.insert(requestDeduplications).values({
        id: crypto.randomUUID(),
        ownerId: user.userId,
        idempotencyKey: parsed.data.idempotencyKey,
        resourceType: 'workout_log',
        resourceId: id,
        createdAt: now,
      }),
    ]);
  } catch {
    return Response.json(
      { error: 'We could not save this workout log. Please try again.' },
      { status: 500 },
    );
  }

  return Response.json(
    {
      log: workoutLogSchema.parse({
        id,
        planId: parsed.data.planId,
        sessionId: parsed.data.sessionId,
        status: requiresReview ? 'stopped_for_safety' : 'completed',
        durationMinutes: parsed.data.durationMinutes,
        rpe: parsed.data.rpe,
        enjoyment: parsed.data.enjoyment ?? null,
        setsCompleted: parsed.data.setsCompleted ?? null,
        repsPerSet: parsed.data.repsPerSet ?? null,
        load: parsed.data.load ?? null,
        loadUnit: parsed.data.loadUnit ?? null,
        averageHeartRate: parsed.data.averageHeartRate ?? null,
        pain: parsed.data.pain,
        concerningSymptoms: parsed.data.concerningSymptoms,
        preGlucose: parsed.data.preGlucose ?? null,
        postGlucose: parsed.data.postGlucose ?? null,
        completedAt: now.toISOString(),
        requiresReview,
      }),
      replayed: false,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
