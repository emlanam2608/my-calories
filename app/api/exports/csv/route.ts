import { and, asc, eq, gte, lt } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { mealEntries, measurements, workoutSessions } from '@/db/schema';
import { nutritionSnapshotSchema } from '@/lib/contracts';

function csv(value: string | number | boolean | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const url = new URL(request.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end)
    return Response.json({ error: 'Choose a valid export date range.' }, { status: 400 });
  const from = new Date(`${start}T00:00:00.000+07:00`);
  const until = new Date(`${end}T00:00:00.000+07:00`); until.setUTCDate(until.getUTCDate() + 1);
  const db = getDb();
  const [meals, values, workouts] = await Promise.all([
    db.select().from(mealEntries).where(and(eq(mealEntries.ownerId, user.userId), gte(mealEntries.occurredAt, from), lt(mealEntries.occurredAt, until))).orderBy(asc(mealEntries.occurredAt)),
    db.select().from(measurements).where(and(eq(measurements.ownerId, user.userId), gte(measurements.occurredAt, from), lt(measurements.occurredAt, until))).orderBy(asc(measurements.occurredAt)),
    db.select().from(workoutSessions).where(and(eq(workoutSessions.ownerId, user.userId), gte(workoutSessions.completedAt, from), lt(workoutSessions.completedAt, until))).orderBy(asc(workoutSessions.completedAt)),
  ]);
  const rows: Array<Array<string | number | boolean | null | undefined>> = [['record_type', 'occurred_at', 'name_or_metric', 'value', 'unit', 'details']];
  meals.forEach((meal) => { const snapshot = nutritionSnapshotSchema.safeParse(meal.nutritionSnapshot); if (snapshot.success) rows.push(['meal', meal.occurredAt.toISOString(), meal.name, snapshot.data.totals.calories, 'kcal', `protein_g=${snapshot.data.totals.protein}; fiber_g=${snapshot.data.totals.fiber}; sodium_mg=${snapshot.data.totals.sodium}; source=${meal.analysisSource}`]); });
  values.forEach((value) => rows.push(['measurement', value.occurredAt.toISOString(), value.label ?? value.metric, value.valueScaled / value.valueScale, value.unit, value.secondaryValueScaled === null ? '' : `secondary=${value.secondaryValueScaled / value.valueScale}`]));
  workouts.filter((workout) => workout.completedAt).forEach((workout) => rows.push(['workout', workout.completedAt!.toISOString(), workout.sessionId ?? 'session', workout.durationMinutes ?? '', 'minutes', `rpe=${workout.rpe ?? ''}; status=${workout.status}`]));
  const content = `\uFEFF${rows.map((row) => row.map(csv).join(',')).join('\r\n')}\r\n`;
  return new Response(content, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="nourishwell-${start}-to-${end}.csv"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
