import { and, desc, eq, inArray } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import {
  requestDeduplications,
  workoutExerciseResults,
  workoutPlans,
  workoutSessions,
} from '@/db/schema';
import { parseStoredWorkoutPlan } from '@/lib/workout-plan-lifecycle';
import {
  WORKOUT_EVIDENCE_VERSION,
  validateExerciseResultsForSession,
  workoutEvidenceLogSchema,
  workoutEvidenceRequestSchema,
  type WorkoutExerciseResult,
} from '@/lib/workout-evidence';

type SessionRow = typeof workoutSessions.$inferSelect;
type ResultRow = typeof workoutExerciseResults.$inferSelect;

function toResult(row: ResultRow): WorkoutExerciseResult {
  return workoutEvidenceLogSchema.shape.exerciseResults.element.parse({
    id: row.id,
    exerciseId: row.exerciseId,
    status: row.status,
    actualSets: row.actualSets ?? undefined,
    actualReps: row.actualReps ?? undefined,
    actualDurationMinutes: row.actualDurationMinutes ?? undefined,
    actualLoad: row.actualLoadScaled === null ? undefined : row.actualLoadScaled / row.actualLoadScale,
    loadUnit: row.loadUnit ?? undefined,
    substitutionId: row.substitutionId ?? undefined,
  });
}

function toLog(row: SessionRow, results: WorkoutExerciseResult[]) {
  return workoutEvidenceLogSchema.parse({
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
    preGlucose: row.preGlucoseScaled === null ? null : row.preGlucoseScaled / row.glucoseScale,
    postGlucose: row.postGlucoseScaled === null ? null : row.postGlucoseScaled / row.glucoseScale,
    completedAt: row.completedAt?.toISOString(),
    requiresReview: row.pain || row.concerningSymptoms,
    evidenceVersion: row.evidenceVersion,
    dataCompleteness: row.dataCompleteness,
    adherenceStatus: row.adherenceStatus,
    exerciseResults: results,
  });
}

async function logsForOwner(ownerId: string, onlyId?: string) {
  const conditions = [eq(workoutSessions.ownerId, ownerId)];
  if (onlyId) conditions.push(eq(workoutSessions.id, onlyId));
  const rows = await getDb().select().from(workoutSessions).where(and(...conditions))
    .orderBy(desc(workoutSessions.completedAt)).limit(onlyId ? 1 : 30);
  const ids = rows.map((row) => row.id);
  const resultRows = ids.length === 0 ? [] : await getDb().select().from(workoutExerciseResults).where(and(
    eq(workoutExerciseResults.ownerId, ownerId),
    inArray(workoutExerciseResults.workoutSessionId, ids),
  ));
  const grouped = new Map<string, WorkoutExerciseResult[]>();
  for (const row of resultRows) {
    const entries = grouped.get(row.workoutSessionId) ?? [];
    entries.push(toResult(row));
    grouped.set(row.workoutSessionId, entries);
  }
  return rows
    .filter((row) => row.planId && row.sessionId && row.completedAt)
    .map((row) => toLog(row, grouped.get(row.id) ?? []));
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  return Response.json({ logs: await logsForOwner(user.userId) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const parsed = workoutEvidenceRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: 'Review the workout-log fields and try again.' }, { status: 400 });
  const db = getDb();
  const existing = await db.select().from(requestDeduplications).where(and(
    eq(requestDeduplications.ownerId, user.userId),
    eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey),
  )).limit(1);
  if (existing[0]) {
    if (existing[0].resourceType !== 'workout_log')
      return Response.json({ error: 'This idempotency key has already been used for a different request.' }, { status: 409 });
    const [log] = await logsForOwner(user.userId, existing[0].resourceId);
    if (!log) return Response.json({ error: 'The original workout log is unavailable.' }, { status: 410 });
    return Response.json({ log, replayed: true }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const planRows = await db.select().from(workoutPlans).where(and(
    eq(workoutPlans.id, parsed.data.planId),
    eq(workoutPlans.ownerId, user.userId),
    inArray(workoutPlans.status, ['active', 'confirmed']),
  )).limit(1);
  const plan = planRows[0] ? parseStoredWorkoutPlan(planRows[0].plan) : null;
  if (!plan) return Response.json({ error: 'This workout plan was not found.' }, { status: 404 });
  let adherenceStatus: 'legacy_unknown' | 'complete' | 'partial' = 'legacy_unknown';
  let evidenceVersion: 'legacy-aggregate-1' | typeof WORKOUT_EVIDENCE_VERSION = 'legacy-aggregate-1';
  let dataCompleteness: 'legacy_aggregate' | 'exercise_level_complete' = 'legacy_aggregate';
  if (plan.planVersion === 'starter-plan-1') {
    if (!plan.sessions.some((session) => session.id === parsed.data.sessionId))
      return Response.json({ error: 'This session is not in your workout plan.' }, { status: 404 });
    if (parsed.data.exerciseResults)
      return Response.json({ error: 'Legacy plans accept aggregate evidence only.' }, { status: 400 });
  } else {
    const validation = validateExerciseResultsForSession(plan, parsed.data.sessionId, parsed.data.exerciseResults);
    if (!validation.ok) return Response.json({ error: validation.error }, { status: 400 });
    adherenceStatus = validation.adherenceStatus;
    evidenceVersion = WORKOUT_EVIDENCE_VERSION;
    dataCompleteness = 'exercise_level_complete';
  }
  const stoppedForSafety = parsed.data.pain || parsed.data.concerningSymptoms;
  const finalAdherence = stoppedForSafety ? 'not_counted_safety_stop' as const : adherenceStatus;
  const now = new Date();
  const id = crypto.randomUUID();
  const resultValues = (parsed.data.exerciseResults ?? []).map((result) => ({
    id: crypto.randomUUID(), ownerId: user.userId, workoutSessionId: id,
    planId: parsed.data.planId, sessionId: parsed.data.sessionId,
    exerciseId: result.exerciseId, status: result.status,
    actualSets: result.actualSets ?? null, actualReps: result.actualReps ?? null,
    actualDurationMinutes: result.actualDurationMinutes ?? null,
    actualLoadScaled: result.actualLoad === undefined ? null : Math.round(result.actualLoad * 10),
    actualLoadScale: 10, loadUnit: result.loadUnit ?? null,
    substitutionId: result.substitutionId ?? null, createdAt: now,
  }));
  try {
    await db.batch([
      db.insert(workoutSessions).values({
        id, ownerId: user.userId, planId: parsed.data.planId,
        sessionId: parsed.data.sessionId, planVersion: plan.planVersion,
        status: stoppedForSafety ? 'stopped_for_safety' : 'completed',
        durationMinutes: parsed.data.durationMinutes, rpe: parsed.data.rpe,
        enjoyment: parsed.data.enjoyment ?? null,
        setsCompleted: parsed.data.setsCompleted ?? null,
        repsPerSet: parsed.data.repsPerSet ?? null,
        loadScaled: parsed.data.load === undefined ? null : Math.round(parsed.data.load * 10),
        loadScale: 10, loadUnit: parsed.data.loadUnit ?? null,
        averageHeartRate: parsed.data.averageHeartRate ?? null,
        pain: parsed.data.pain, concerningSymptoms: parsed.data.concerningSymptoms,
        preGlucoseScaled: parsed.data.preGlucose === undefined ? null : Math.round(parsed.data.preGlucose * 10),
        postGlucoseScaled: parsed.data.postGlucose === undefined ? null : Math.round(parsed.data.postGlucose * 10),
        glucoseScale: 10, safetyNotes: null, evidenceVersion, dataCompleteness,
        adherenceStatus: finalAdherence, completedAt: now,
      }),
      ...resultValues.map((value) => db.insert(workoutExerciseResults).values(value)),
      db.insert(requestDeduplications).values({
        id: crypto.randomUUID(), ownerId: user.userId,
        idempotencyKey: parsed.data.idempotencyKey,
        resourceType: 'workout_log', resourceId: id, createdAt: now,
      }),
    ]);
  } catch {
    return Response.json({ error: 'We could not save this workout log. Please try again.' }, { status: 500 });
  }
  const [log] = await logsForOwner(user.userId, id);
  return Response.json({ log, replayed: false }, { headers: { 'Cache-Control': 'no-store' } });
}
