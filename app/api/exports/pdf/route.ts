import { and, asc, eq, gte, lt } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { mealEntries, measurements, workoutSessions } from '@/db/schema';
import { nutritionSnapshotSchema } from '@/lib/contracts';
import { createTextPdf } from '@/lib/pdf-report';

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const url = new URL(request.url); const start = url.searchParams.get('start'); const end = url.searchParams.get('end');
  if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) return Response.json({ error: 'Choose a valid export date range.' }, { status: 400 });
  const from = new Date(`${start}T00:00:00.000+07:00`); const until = new Date(`${end}T00:00:00.000+07:00`); until.setUTCDate(until.getUTCDate() + 1);
  const db = getDb();
  const [meals, values, workouts] = await Promise.all([
    db.select().from(mealEntries).where(and(eq(mealEntries.ownerId, user.userId), gte(mealEntries.occurredAt, from), lt(mealEntries.occurredAt, until))).orderBy(asc(mealEntries.occurredAt)),
    db.select().from(measurements).where(and(eq(measurements.ownerId, user.userId), gte(measurements.occurredAt, from), lt(measurements.occurredAt, until))).orderBy(asc(measurements.occurredAt)),
    db.select().from(workoutSessions).where(and(eq(workoutSessions.ownerId, user.userId), gte(workoutSessions.completedAt, from), lt(workoutSessions.completedAt, until))).orderBy(asc(workoutSessions.completedAt)),
  ]);
  const lines = [`Private clinician summary | ${start} to ${end}`, `Meals: ${meals.length} | Measurements: ${values.length} | Workouts: ${workouts.length}`, '', 'MEALS'];
  meals.forEach((meal) => { const snapshot = nutritionSnapshotSchema.safeParse(meal.nutritionSnapshot); if (snapshot.success) lines.push(`${meal.occurredAt.toISOString()} | ${meal.name} | ${snapshot.data.totals.calories} kcal | protein ${snapshot.data.totals.protein} g | sodium ${snapshot.data.totals.sodium} mg`); });
  lines.push('', 'MEASUREMENTS'); values.forEach((value) => lines.push(`${value.occurredAt.toISOString()} | ${value.label ?? value.metric}: ${value.valueScaled / value.valueScale} ${value.unit}${value.secondaryValueScaled === null ? '' : ` / ${value.secondaryValueScaled / value.valueScale}`}`));
  lines.push('', 'WORKOUTS'); workouts.filter((workout) => workout.completedAt).forEach((workout) => lines.push(`${workout.completedAt!.toISOString()} | ${workout.sessionId ?? 'session'} | ${workout.durationMinutes ?? ''} min | RPE ${workout.rpe ?? ''} | ${workout.status}`));
  const pdf = createTextPdf('Nourishwell private report', lines);
  return new Response(pdf, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="nourishwell-${start}-to-${end}.pdf"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
