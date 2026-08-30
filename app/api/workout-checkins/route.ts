import { and, eq } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { requestDeduplications, workoutCheckins, workoutPlans, workoutSessions } from '@/db/schema';
import { workoutCheckinRequestSchema, workoutCheckinSchema, workoutPlanSchema } from '@/lib/contracts';
import { evaluateWorkoutCheckin } from '@/lib/workout-checkin';

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const parsed = workoutCheckinRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Choose a valid confirmed plan.' }, { status: 400 });
  const db = getDb();
  const planRow = await db.select({ plan: workoutPlans.plan }).from(workoutPlans).where(and(eq(workoutPlans.id, parsed.data.planId), eq(workoutPlans.ownerId, user.userId), eq(workoutPlans.status, 'confirmed'))).limit(1);
  const plan = planRow[0] ? workoutPlanSchema.safeParse(planRow[0].plan) : null;
  if (!plan?.success) return Response.json({ error: 'The confirmed plan was not found.' }, { status: 404 });
  const existing = await db.select({ resourceType: requestDeduplications.resourceType }).from(requestDeduplications).where(and(eq(requestDeduplications.ownerId, user.userId), eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey))).limit(1);
  if (existing[0]) return Response.json({ error: 'This check-in was already submitted.' }, { status: 409 });
  const logs = await db.select({ sessionId: workoutSessions.sessionId, pain: workoutSessions.pain, concerningSymptoms: workoutSessions.concerningSymptoms }).from(workoutSessions).where(and(eq(workoutSessions.ownerId, user.userId), eq(workoutSessions.planId, parsed.data.planId)));
  const completed = new Set(logs.map((log) => log.sessionId).filter(Boolean)).size;
  const review = evaluateWorkoutCheckin({ planned: plan.data.sessions.length, completed, safetyFlag: logs.some((log) => log.pain || log.concerningSymptoms) });
  const now = new Date(); const id = crypto.randomUUID();
  await db.batch([
    db.insert(workoutCheckins).values({ id, ownerId: user.userId, planId: parsed.data.planId, action: review.action, plannedSessions: review.planned, completedSessions: review.completed, safetyFlag: review.safetyFlag, createdAt: now }),
    db.insert(requestDeduplications).values({ id: crypto.randomUUID(), ownerId: user.userId, idempotencyKey: parsed.data.idempotencyKey, resourceType: 'workout_checkin', resourceId: id, createdAt: now }),
  ]);
  return Response.json({ checkin: workoutCheckinSchema.parse({ id, planId: parsed.data.planId, ...review, createdAt: now.toISOString() }) }, { headers: { 'Cache-Control': 'no-store' } });
}
