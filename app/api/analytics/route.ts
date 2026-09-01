import { and, eq, gte, isNotNull } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { mealEntries, measurements, workoutSessions } from '@/db/schema';
import { analyticsResponseSchema, nutritionSnapshotSchema } from '@/lib/contracts';
import { buildAnalytics } from '@/lib/analytics';

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const requestedDays = Number(new URL(request.url).searchParams.get('days') ?? 30);
  const periodDays = Math.min(90, Math.max(7, Number.isFinite(requestedDays) ? Math.floor(requestedDays) : 30));
  const since = new Date(Date.now() - periodDays * 86_400_000);
  const db = getDb();
  const [mealRows, measurementRows, workoutRows] = await Promise.all([
    db.select({ occurredAt: mealEntries.occurredAt, nutritionSnapshot: mealEntries.nutritionSnapshot }).from(mealEntries).where(and(gte(mealEntries.occurredAt, since), eq(mealEntries.ownerId, user.userId))),
    db.select({ metric: measurements.metric, valueScaled: measurements.valueScaled, valueScale: measurements.valueScale, unit: measurements.unit, occurredAt: measurements.occurredAt }).from(measurements).where(and(gte(measurements.occurredAt, since), eq(measurements.ownerId, user.userId))),
    db.select({ status: workoutSessions.status, durationMinutes: workoutSessions.durationMinutes, completedAt: workoutSessions.completedAt }).from(workoutSessions).where(and(eq(workoutSessions.ownerId, user.userId), isNotNull(workoutSessions.completedAt), gte(workoutSessions.completedAt, since))),
  ]);
  const meals = mealRows.flatMap((row) => {
    const snapshot = nutritionSnapshotSchema.safeParse(row.nutritionSnapshot);
    return snapshot.success ? [{ occurredAt: row.occurredAt, ...snapshot.data.totals }] : [];
  });
  return Response.json(
    analyticsResponseSchema.parse(buildAnalytics({
      periodDays,
      meals,
      measurements: measurementRows.map((row) => ({ metric: row.metric, value: row.valueScaled / row.valueScale, unit: row.unit, occurredAt: row.occurredAt })),
      workouts: workoutRows.flatMap((row) => row.completedAt && row.durationMinutes !== null ? [{ status: row.status as 'completed' | 'stopped_for_safety', durationMinutes: row.durationMinutes, completedAt: row.completedAt }] : []),
    })),
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
