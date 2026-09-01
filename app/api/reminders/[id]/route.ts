import { and, eq } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { reminders, requestDeduplications } from '@/db/schema';
import { reminderActionRequestSchema, reminderSchema } from '@/lib/contracts';
import { nextReminderDelivery, snoozedReminderDelivery, type ReminderSchedule } from '@/lib/reminder-scheduling';

function serialize(row: typeof reminders.$inferSelect) {
  return reminderSchema.parse({
    id: row.id,
    kind: row.kind,
    schedule: row.schedule,
    nextDeliveryAt: row.nextDeliveryAt.toISOString(),
    status: row.status,
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const id = (await params).id;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return Response.json({ error: 'Choose a valid reminder.' }, { status: 400 });
  const parsed = reminderActionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Choose a valid reminder action.' }, { status: 400 });
  const db = getDb();
  const replay = await db.select({ resourceId: requestDeduplications.resourceId, resourceType: requestDeduplications.resourceType }).from(requestDeduplications).where(and(eq(requestDeduplications.ownerId, user.userId), eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey))).limit(1);
  if (replay[0]) {
    if (replay[0].resourceType !== 'reminder_action') return Response.json({ error: 'This idempotency key has already been used for a different request.' }, { status: 409 });
    if (parsed.data.action === 'delete') return Response.json({ id: replay[0].resourceId, deleted: true, replayed: true }, { headers: { 'Cache-Control': 'no-store' } });
    const replayedReminder = (await db.select().from(reminders).where(and(eq(reminders.id, replay[0].resourceId), eq(reminders.ownerId, user.userId))).limit(1))[0];
    return replayedReminder
      ? Response.json({ reminder: serialize(replayedReminder), replayed: true }, { headers: { 'Cache-Control': 'no-store' } })
      : Response.json({ error: 'Reminder not found.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  const row = (await db.select().from(reminders).where(and(eq(reminders.id, id), eq(reminders.ownerId, user.userId))).limit(1))[0];
  if (!row) return Response.json({ error: 'Reminder not found.' }, { status: 404 });
  const now = new Date();
  if (parsed.data.action === 'delete') await db.delete(reminders).where(and(eq(reminders.id, id), eq(reminders.ownerId, user.userId)));
  else if (parsed.data.action === 'snooze') {
    await db.update(reminders).set({ status: 'active', nextDeliveryAt: snoozedReminderDelivery(row.schedule as ReminderSchedule, parsed.data.minutes, now) }).where(and(eq(reminders.id, id), eq(reminders.ownerId, user.userId)));
  } else if (parsed.data.action === 'reschedule') {
    await db.update(reminders).set({ status: 'active', schedule: parsed.data.schedule, nextDeliveryAt: nextReminderDelivery(parsed.data.schedule, now) }).where(and(eq(reminders.id, id), eq(reminders.ownerId, user.userId)));
  } else {
    const status = parsed.data.action === 'pause' ? 'paused' : 'active';
    await db.update(reminders).set({ status, ...(status === 'active' ? { nextDeliveryAt: nextReminderDelivery(row.schedule as ReminderSchedule, now) } : {}) }).where(and(eq(reminders.id, id), eq(reminders.ownerId, user.userId)));
  }
  await db.insert(requestDeduplications).values({ id: crypto.randomUUID(), ownerId: user.userId, idempotencyKey: parsed.data.idempotencyKey, resourceType: 'reminder_action', resourceId: id, createdAt: now });
  if (parsed.data.action === 'delete') return Response.json({ id, deleted: true }, { headers: { 'Cache-Control': 'no-store' } });
  const updated = (await db.select().from(reminders).where(and(eq(reminders.id, id), eq(reminders.ownerId, user.userId))).limit(1))[0]!;
  return Response.json({ reminder: serialize(updated) }, { headers: { 'Cache-Control': 'no-store' } });
}
