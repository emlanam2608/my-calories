import { and, desc, eq } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { requestDeduplications, workoutCheckins, workoutPlans, workoutSessions } from '@/db/schema';
import { safetyReasonCodeSchema, workoutCheckinRequestSchema, workoutCheckinSchema, workoutPlanSchema } from '@/lib/contracts';
import { resolveEffectiveSafetyContextForOwner } from '@/lib/effective-safety-context-server';
import { evaluateWorkoutCheckin } from '@/lib/workout-checkin';

function serializeCheckin(row: typeof workoutCheckins.$inferSelect) {
  const reasonCodes = Array.isArray(row.safetyReasonCodes)
    ? row.safetyReasonCodes.flatMap((code) => {
        const parsed = safetyReasonCodeSchema.safeParse(code);
        return parsed.success ? [parsed.data] : [];
      })
    : [];
  return workoutCheckinSchema.parse({
    id: row.id,
    planId: row.planId,
    action: row.action,
    plannedSessions: row.plannedSessions,
    completedSessions: row.completedSessions,
    safetyFlag: row.safetyFlag,
    safetyContextVersion: row.safetyContextVersion,
    safetyDecision: row.safetyDecision,
    safetyReasonCodes: reasonCodes,
    createdAt: row.createdAt.toISOString(),
  });
}

async function checkinForOwner(ownerId: string, id?: string) {
  const conditions = [eq(workoutCheckins.ownerId, ownerId)];
  if (id) conditions.push(eq(workoutCheckins.id, id));
  const rows = await getDb().select().from(workoutCheckins)
    .where(and(...conditions)).orderBy(desc(workoutCheckins.createdAt)).limit(1);
  return rows[0] ? serializeCheckin(rows[0]) : null;
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  return Response.json({ checkin: await checkinForOwner(user.userId) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const parsed = workoutCheckinRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Choose a valid confirmed plan.' }, { status: 400 });
  const db = getDb();
  const planRow = await db.select({ plan: workoutPlans.plan }).from(workoutPlans).where(and(eq(workoutPlans.id, parsed.data.planId), eq(workoutPlans.ownerId, user.userId), eq(workoutPlans.status, 'confirmed'))).limit(1);
  const plan = planRow[0] ? workoutPlanSchema.safeParse(planRow[0].plan) : null;
  if (!plan?.success) return Response.json({ error: 'The confirmed plan was not found.' }, { status: 404 });
  const existing = await db.select({ resourceId: requestDeduplications.resourceId, resourceType: requestDeduplications.resourceType }).from(requestDeduplications).where(and(eq(requestDeduplications.ownerId, user.userId), eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey))).limit(1);
  if (existing[0]) {
    if (existing[0].resourceType !== 'workout_checkin')
      return Response.json({ error: 'This idempotency key has already been used for a different request.' }, { status: 409 });
    return Response.json({ checkin: await checkinForOwner(user.userId, existing[0].resourceId), replayed: true }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const logs = await db.select({ sessionId: workoutSessions.sessionId }).from(workoutSessions).where(and(eq(workoutSessions.ownerId, user.userId), eq(workoutSessions.planId, parsed.data.planId)));
  const completed = new Set(logs.map((log) => log.sessionId).filter(Boolean)).size;
  const safetyContext = await resolveEffectiveSafetyContextForOwner(user.userId);
  const safetyDecision = safetyContext.decisions.workout_progression;
  const review = evaluateWorkoutCheckin({ planned: plan.data.sessions.length, completed, safetyFlag: safetyDecision.status === 'blocked' });
  const now = new Date();
  const id = crypto.randomUUID();
  const safetyReasonCodes = safetyDecision.reasons.map((reason) => reason.code);
  await db.batch([
    db.insert(workoutCheckins).values({
      id, ownerId: user.userId, planId: parsed.data.planId, action: review.action,
      plannedSessions: review.planned, completedSessions: review.completed,
      safetyFlag: review.safetyFlag, safetyContextVersion: safetyContext.contextVersion,
      safetyDecision: safetyDecision.status, safetyReasonCodes, createdAt: now,
    }),
    db.insert(requestDeduplications).values({ id: crypto.randomUUID(), ownerId: user.userId, idempotencyKey: parsed.data.idempotencyKey, resourceType: 'workout_checkin', resourceId: id, createdAt: now }),
  ]);
  return Response.json({
    checkin: workoutCheckinSchema.parse({
      id,
      planId: parsed.data.planId,
      action: review.action,
      plannedSessions: review.planned,
      completedSessions: review.completed,
      safetyFlag: review.safetyFlag,
      safetyContextVersion: safetyContext.contextVersion,
      safetyDecision: safetyDecision.status,
      safetyReasonCodes,
      createdAt: now.toISOString(),
    }),
    replayed: false,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
