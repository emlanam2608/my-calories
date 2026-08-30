import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { createMealRequestSchema, nutritionSnapshotSchema } from '@/lib/contracts';
import { getDb } from '@/db';
import { mealEntries, requestDeduplications } from '@/db/schema';

function dayBounds(value: string | null) {
  const day = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 10);
  const start = new Date(`${day}T00:00:00.000+07:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const { start, end } = dayBounds(new URL(request.url).searchParams.get('date'));
  const rows = await getDb().select().from(mealEntries).where(and(eq(mealEntries.ownerId, user.userId), gte(mealEntries.occurredAt, start), lt(mealEntries.occurredAt, end))).orderBy(desc(mealEntries.occurredAt));
  const meals = rows.flatMap((row) => {
    const snapshot = nutritionSnapshotSchema.safeParse(row.nutritionSnapshot);
    return snapshot.success ? [{ ...row, nutritionSnapshot: snapshot.data }] : [];
  });
  return Response.json({ meals }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = createMealRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'The meal could not be validated. Review every required field.' }, { status: 400 });

  const db = getDb();
  const existing = await db.select({ resourceId: requestDeduplications.resourceId, resourceType: requestDeduplications.resourceType }).from(requestDeduplications).where(and(eq(requestDeduplications.ownerId, user.userId), eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey))).limit(1);
  if (existing[0]) {
    if (existing[0].resourceType !== 'meal') return Response.json({ error: 'This idempotency key has already been used for a different request.' }, { status: 409 });
    return Response.json({ id: existing[0].resourceId, replayed: true });
  }

  const id = crypto.randomUUID();
  const now = new Date();
  try {
    await db.batch([
      db.insert(mealEntries).values({ id, ownerId: user.userId, occurredAt: new Date(parsed.data.occurredAt), mealType: parsed.data.mealType, name: parsed.data.name, nutritionSnapshot: parsed.data.nutritionSnapshot, analysisSource: parsed.data.analysisSource, confidence: parsed.data.confidence, createdAt: now }),
      db.insert(requestDeduplications).values({ id: crypto.randomUUID(), ownerId: user.userId, idempotencyKey: parsed.data.idempotencyKey, resourceType: 'meal', resourceId: id, createdAt: now }),
    ]);
  } catch {
    const replay = await db.select({ resourceId: requestDeduplications.resourceId, resourceType: requestDeduplications.resourceType }).from(requestDeduplications).where(and(eq(requestDeduplications.ownerId, user.userId), eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey))).limit(1);
    if (replay[0]?.resourceType === 'meal') return Response.json({ id: replay[0].resourceId, replayed: true });
    if (replay[0]) return Response.json({ error: 'This idempotency key has already been used for a different request.' }, { status: 409 });
    return Response.json({ error: 'We could not save this meal. Please try again.' }, { status: 500 });
  }
  return Response.json({ id, replayed: false }, { status: 201 });
}
