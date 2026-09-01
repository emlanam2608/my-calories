import { and, desc, eq } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { requestDeduplications, savedFoods } from '@/db/schema';
import {
  savePersonalFoodRequestSchema,
  savedFoodSchema,
  savedFoodsResponseSchema,
} from '@/lib/contracts';
import { normalizePersonalFoodName } from '@/lib/saved-food-normalization';

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const rows = await getDb()
    .select()
    .from(savedFoods)
    .where(eq(savedFoods.ownerId, user.userId))
    .orderBy(desc(savedFoods.updatedAt))
    .limit(100);
  return Response.json(
    savedFoodsResponseSchema.parse({
      savedFoods: rows.flatMap((row) => {
        const item = savedFoodSchema.safeParse({
          id: row.id,
          kind: row.kind,
          name: row.name,
          nameVi: row.nameVi,
          nutritionSnapshot: row.nutritionSnapshot,
          updatedAt: row.updatedAt.toISOString(),
        });
        return item.success ? [item.data] : [];
      }),
    }),
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const parsed = savePersonalFoodRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: 'Review the personal food details before saving.' }, { status: 400 });

  const db = getDb();
  const replay = await db
    .select({ resourceId: requestDeduplications.resourceId, resourceType: requestDeduplications.resourceType })
    .from(requestDeduplications)
    .where(and(eq(requestDeduplications.ownerId, user.userId), eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey)))
    .limit(1);
  if (replay[0]) {
    if (replay[0].resourceType !== 'saved_food')
      return Response.json({ error: 'This idempotency key has already been used for a different request.' }, { status: 409 });
    return Response.json({ id: replay[0].resourceId, replayed: true });
  }

  const normalizedName = normalizePersonalFoodName(parsed.data.name);
  const current = await db
    .select({ id: savedFoods.id })
    .from(savedFoods)
    .where(and(eq(savedFoods.ownerId, user.userId), eq(savedFoods.normalizedName, normalizedName)))
    .limit(1);
  const id = current[0]?.id ?? crypto.randomUUID();
  const now = new Date();
  try {
    await db.batch([
      db
        .insert(savedFoods)
        .values({
          id,
          ownerId: user.userId,
          kind: parsed.data.kind,
          name: parsed.data.name,
          nameVi: parsed.data.nameVi,
          normalizedName,
          nutritionSnapshot: parsed.data.nutritionSnapshot,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [savedFoods.ownerId, savedFoods.normalizedName],
          set: {
            kind: parsed.data.kind,
            name: parsed.data.name,
            nameVi: parsed.data.nameVi,
            nutritionSnapshot: parsed.data.nutritionSnapshot,
            updatedAt: now,
          },
        }),
      db.insert(requestDeduplications).values({
        id: crypto.randomUUID(),
        ownerId: user.userId,
        idempotencyKey: parsed.data.idempotencyKey,
        resourceType: 'saved_food',
        resourceId: id,
        createdAt: now,
      }),
    ]);
  } catch {
    const retried = await db
      .select({ resourceId: requestDeduplications.resourceId, resourceType: requestDeduplications.resourceType })
      .from(requestDeduplications)
      .where(and(eq(requestDeduplications.ownerId, user.userId), eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey)))
      .limit(1);
    if (retried[0]?.resourceType === 'saved_food')
      return Response.json({ id: retried[0].resourceId, replayed: true });
    return Response.json({ error: 'We could not save this personal food. Please try again.' }, { status: 500 });
  }
  return Response.json({ id, replayed: false }, { status: 201 });
}
