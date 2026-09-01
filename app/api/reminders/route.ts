import { and, desc, eq } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { reminders, requestDeduplications } from '@/db/schema';
import { reminderCreateRequestSchema, reminderSchema, remindersResponseSchema } from '@/lib/contracts';
import { nextReminderDelivery } from '@/lib/reminder-scheduling';

function serialize(row: typeof reminders.$inferSelect) {
  return reminderSchema.parse({
    id: row.id,
    kind: row.kind,
    schedule: row.schedule,
    nextDeliveryAt: row.nextDeliveryAt.toISOString(),
    status: row.status,
  });
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const rows = await getDb().select().from(reminders).where(eq(reminders.ownerId, user.userId)).orderBy(desc(reminders.nextDeliveryAt)).limit(50);
  return Response.json(remindersResponseSchema.parse({ reminders: rows.flatMap((row) => { try { return [serialize(row)]; } catch { return []; } }) }), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const parsed = reminderCreateRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Review the reminder schedule and try again.' }, { status: 400 });
  const db = getDb();
  const replay = await db.select({ resourceId: requestDeduplications.resourceId, resourceType: requestDeduplications.resourceType }).from(requestDeduplications).where(and(eq(requestDeduplications.ownerId, user.userId), eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey))).limit(1);
  if (replay[0]) {
    if (replay[0].resourceType !== 'reminder') return Response.json({ error: 'This idempotency key has already been used for a different request.' }, { status: 409 });
    const row = (await db.select().from(reminders).where(and(eq(reminders.id, replay[0].resourceId), eq(reminders.ownerId, user.userId))).limit(1))[0];
    return row ? Response.json({ reminder: serialize(row), replayed: true }, { headers: { 'Cache-Control': 'no-store' } }) : Response.json({ error: 'Reminder not found.' }, { status: 404 });
  }
  const id = crypto.randomUUID();
  const now = new Date();
  const nextDeliveryAt = nextReminderDelivery(parsed.data.schedule, now);
  await db.batch([
    db.insert(reminders).values({ id, ownerId: user.userId, kind: parsed.data.kind, schedule: parsed.data.schedule, nextDeliveryAt, status: 'active' }),
    db.insert(requestDeduplications).values({ id: crypto.randomUUID(), ownerId: user.userId, idempotencyKey: parsed.data.idempotencyKey, resourceType: 'reminder', resourceId: id, createdAt: now }),
  ]);
  return Response.json({ reminder: reminderSchema.parse({ id, kind: parsed.data.kind, schedule: parsed.data.schedule, nextDeliveryAt: nextDeliveryAt.toISOString(), status: 'active' }), replayed: false }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
