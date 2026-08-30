import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { healthTargets, profiles, requestDeduplications } from '@/db/schema';
import {
  profileLocaleSchema,
  profileTargetsResponseSchema,
  updateProfileTargetsRequestSchema,
} from '@/lib/contracts';
import { selectTargets } from '@/lib/targets';
import { and, eq } from 'drizzle-orm';

async function targetsForOwner(ownerId: string) {
  const rows = await getDb()
    .select({
      metric: healthTargets.metric,
      valueScaled: healthTargets.valueScaled,
      valueScale: healthTargets.valueScale,
      unit: healthTargets.unit,
      authority: healthTargets.authority,
      updatedAt: healthTargets.updatedAt,
    })
    .from(healthTargets)
    .where(eq(healthTargets.ownerId, ownerId));
  const profile = await getDb()
    .select({ locale: profiles.locale })
    .from(profiles)
    .where(eq(profiles.ownerId, ownerId))
    .limit(1);
  const locale = profileLocaleSchema.safeParse(profile[0]?.locale);
  return profileTargetsResponseSchema.parse({
    locale: locale.success ? locale.data : 'vi',
    targets: selectTargets(rows),
  });
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const db = getDb();
  const now = new Date();
  await db
    .insert(profiles)
    .values({
      id: crypto.randomUUID(),
      ownerId: user.userId,
      displayName: user.displayName,
      locale: 'vi',
      timezone: 'Asia/Bangkok',
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
  return Response.json(await targetsForOwner(user.userId), {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = updateProfileTargetsRequestSchema.safeParse(body);
  if (!parsed.success)
    return Response.json(
      {
        error:
          'Enter one valid non-negative target for calories, protein, fiber, and sodium.',
      },
      { status: 400 },
    );

  const db = getDb();
  const existing = await db
    .select({
      resourceId: requestDeduplications.resourceId,
      resourceType: requestDeduplications.resourceType,
    })
    .from(requestDeduplications)
    .where(
      and(
        eq(requestDeduplications.ownerId, user.userId),
        eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey),
      ),
    )
    .limit(1);
  if (existing[0]) {
    if (existing[0].resourceType !== 'profile_targets')
      return Response.json(
        {
          error:
            'This idempotency key has already been used for a different request.',
        },
        { status: 409 },
      );
    return Response.json(
      { ...(await targetsForOwner(user.userId)), replayed: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const now = new Date();
  try {
    await db.batch([
      db
        .delete(healthTargets)
        .where(
          and(
            eq(healthTargets.ownerId, user.userId),
            eq(healthTargets.authority, 'user_defined'),
          ),
        ),
      ...parsed.data.targets.map((target) =>
        db
          .insert(healthTargets)
          .values({
            id: crypto.randomUUID(),
            ownerId: user.userId,
            metric: target.metric,
            valueScaled: Math.round(target.value * 100),
            valueScale: 100,
            unit: target.unit,
            authority: 'user_defined',
            updatedAt: now,
          }),
      ),
      db
        .insert(requestDeduplications)
        .values({
          id: crypto.randomUUID(),
          ownerId: user.userId,
          idempotencyKey: parsed.data.idempotencyKey,
          resourceType: 'profile_targets',
          resourceId: 'targets',
          createdAt: now,
        }),
    ]);
  } catch {
    const replay = await db
      .select({
        resourceId: requestDeduplications.resourceId,
        resourceType: requestDeduplications.resourceType,
      })
      .from(requestDeduplications)
      .where(
        and(
          eq(requestDeduplications.ownerId, user.userId),
          eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey),
        ),
      )
      .limit(1);
    if (replay[0]?.resourceType === 'profile_targets')
      return Response.json(
        { ...(await targetsForOwner(user.userId)), replayed: true },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    if (replay[0])
      return Response.json(
        {
          error:
            'This idempotency key has already been used for a different request.',
        },
        { status: 409 },
      );
    return Response.json(
      { error: 'We could not save your targets. Please try again.' },
      { status: 500 },
    );
  }

  return Response.json(
    { ...(await targetsForOwner(user.userId)), replayed: false },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
