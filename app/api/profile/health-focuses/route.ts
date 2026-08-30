import { and, eq } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { healthFocuses, requestDeduplications } from '@/db/schema';
import { healthFocusesResponseSchema, healthFocusSchema, updateHealthFocusesRequestSchema } from '@/lib/contracts';

async function focusesForOwner(ownerId: string) {
  const rows = await getDb().select({ focus: healthFocuses.focus }).from(healthFocuses).where(eq(healthFocuses.ownerId, ownerId));
  return healthFocusesResponseSchema.parse({ focuses: rows.flatMap((row) => { const focus = healthFocusSchema.safeParse(row.focus); return focus.success ? [focus.data] : []; }) });
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  return Response.json(await focusesForOwner(user.userId), { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const parsed = updateHealthFocusesRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Select each health focus only once.' }, { status: 400 });

  const db = getDb();
  const existing = await db.select({ resourceId: requestDeduplications.resourceId, resourceType: requestDeduplications.resourceType }).from(requestDeduplications).where(and(eq(requestDeduplications.ownerId, user.userId), eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey))).limit(1);
  if (existing[0]) {
    if (existing[0].resourceType !== 'health_focuses') return Response.json({ error: 'This idempotency key has already been used for a different request.' }, { status: 409 });
    return Response.json({ ...(await focusesForOwner(user.userId)), replayed: true }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const now = new Date();
  try {
    await db.batch([
      db.delete(healthFocuses).where(eq(healthFocuses.ownerId, user.userId)),
      ...parsed.data.focuses.map((focus) => db.insert(healthFocuses).values({ id: crypto.randomUUID(), ownerId: user.userId, focus, createdAt: now, updatedAt: now })),
      db.insert(requestDeduplications).values({ id: crypto.randomUUID(), ownerId: user.userId, idempotencyKey: parsed.data.idempotencyKey, resourceType: 'health_focuses', resourceId: 'focuses', createdAt: now }),
    ]);
  } catch {
    const replay = await db.select({ resourceId: requestDeduplications.resourceId, resourceType: requestDeduplications.resourceType }).from(requestDeduplications).where(and(eq(requestDeduplications.ownerId, user.userId), eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey))).limit(1);
    if (replay[0]?.resourceType === 'health_focuses') return Response.json({ ...(await focusesForOwner(user.userId)), replayed: true }, { headers: { 'Cache-Control': 'no-store' } });
    if (replay[0]) return Response.json({ error: 'This idempotency key has already been used for a different request.' }, { status: 409 });
    return Response.json({ error: 'We could not save your health focuses. Please try again.' }, { status: 500 });
  }

  return Response.json({ ...(await focusesForOwner(user.userId)), replayed: false }, { headers: { 'Cache-Control': 'no-store' } });
}
