import { and, eq } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { requestDeduplications, savedFoods } from '@/db/schema';
import { deleteSavedFoodRequestSchema } from '@/lib/contracts';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const id = (await params).id;
  if (!crypto.randomUUID || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
    return Response.json({ error: 'Choose a valid saved food.' }, { status: 400 });
  const parsed = deleteSavedFoodRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Confirm the saved food deletion and try again.' }, { status: 400 });
  const db = getDb();
  const replay = await db.select({ resourceId: requestDeduplications.resourceId, resourceType: requestDeduplications.resourceType }).from(requestDeduplications).where(and(eq(requestDeduplications.ownerId, user.userId), eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey))).limit(1);
  if (replay[0]) {
    if (replay[0].resourceType !== 'saved_food_delete') return Response.json({ error: 'This idempotency key has already been used for a different request.' }, { status: 409 });
    return Response.json({ id: replay[0].resourceId, replayed: true }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const existing = await db.select({ id: savedFoods.id }).from(savedFoods).where(and(eq(savedFoods.id, id), eq(savedFoods.ownerId, user.userId))).limit(1);
  if (!existing[0]) return Response.json({ error: 'Saved food not found.' }, { status: 404 });
  const now = new Date();
  await db.batch([
    db.delete(savedFoods).where(and(eq(savedFoods.id, id), eq(savedFoods.ownerId, user.userId))),
    db.insert(requestDeduplications).values({ id: crypto.randomUUID(), ownerId: user.userId, idempotencyKey: parsed.data.idempotencyKey, resourceType: 'saved_food_delete', resourceId: id, createdAt: now }),
  ]);
  return Response.json({ id, replayed: false }, { headers: { 'Cache-Control': 'no-store' } });
}
