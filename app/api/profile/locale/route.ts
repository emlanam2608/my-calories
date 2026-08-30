import { and, eq } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { profiles, requestDeduplications } from '@/db/schema';
import {
  profileLocaleResponseSchema,
  profileLocaleSchema,
  updateProfileLocaleRequestSchema,
} from '@/lib/contracts';

async function localeForOwner(ownerId: string) {
  const row = await getDb()
    .select({ locale: profiles.locale })
    .from(profiles)
    .where(eq(profiles.ownerId, ownerId))
    .limit(1);
  const locale = profileLocaleSchema.safeParse(row[0]?.locale);
  return profileLocaleResponseSchema.parse({
    locale: locale.success ? locale.data : 'vi',
  });
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  return Response.json(await localeForOwner(user.userId), {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const parsed = updateProfileLocaleRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      { error: 'Choose English or Vietnamese.' },
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
    if (existing[0].resourceType !== 'profile_locale')
      return Response.json(
        {
          error:
            'This idempotency key has already been used for a different request.',
        },
        { status: 409 },
      );
    return Response.json(
      { ...(await localeForOwner(user.userId)), replayed: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const now = new Date();
  try {
    await db.batch([
      db
        .insert(profiles)
        .values({
          id: crypto.randomUUID(),
          ownerId: user.userId,
          displayName: user.displayName,
          locale: parsed.data.locale,
          timezone: 'Asia/Bangkok',
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: profiles.ownerId,
          set: { locale: parsed.data.locale, updatedAt: now },
        }),
      db
        .insert(requestDeduplications)
        .values({
          id: crypto.randomUUID(),
          ownerId: user.userId,
          idempotencyKey: parsed.data.idempotencyKey,
          resourceType: 'profile_locale',
          resourceId: 'locale',
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
    if (replay[0]?.resourceType === 'profile_locale')
      return Response.json(
        { ...(await localeForOwner(user.userId)), replayed: true },
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
      {
        error: 'We could not save your language preference. Please try again.',
      },
      { status: 500 },
    );
  }
  return Response.json(
    { ...(await localeForOwner(user.userId)), replayed: false },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
