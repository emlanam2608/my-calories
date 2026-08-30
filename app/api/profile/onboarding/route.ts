import { and, eq } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { profileOnboarding, requestDeduplications } from '@/db/schema';
import { onboardingResponseSchema, onboardingDraftSchema, updateOnboardingRequestSchema } from '@/lib/contracts';
import { onboardingStatus } from '@/lib/onboarding';

async function onboardingForOwner(ownerId: string) {
  const row = await getDb().select().from(profileOnboarding).where(eq(profileOnboarding.ownerId, ownerId)).limit(1);
  if (!row[0]) return onboardingResponseSchema.parse({ draft: {}, status: 'in_progress', updatedAt: null });
  const draft = onboardingDraftSchema.parse(row[0].draft);
  return onboardingResponseSchema.parse({ draft, status: onboardingStatus(draft), updatedAt: row[0].updatedAt.toISOString() });
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  return Response.json(await onboardingForOwner(user.userId), { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const parsed = updateOnboardingRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Review the onboarding choices and try again.' }, { status: 400 });
  const db = getDb();
  const duplicate = await db.select({ resourceType: requestDeduplications.resourceType }).from(requestDeduplications).where(and(eq(requestDeduplications.ownerId, user.userId), eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey))).limit(1);
  if (duplicate[0]) {
    if (duplicate[0].resourceType !== 'profile_onboarding') return Response.json({ error: 'This idempotency key has already been used for a different request.' }, { status: 409 });
    return Response.json({ ...(await onboardingForOwner(user.userId)), replayed: true }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const now = new Date();
  const status = onboardingStatus(parsed.data.draft);
  try {
    await db.batch([
      db.insert(profileOnboarding).values({ id: crypto.randomUUID(), ownerId: user.userId, draft: parsed.data.draft, status, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: profileOnboarding.ownerId, set: { draft: parsed.data.draft, status, updatedAt: now } }),
      db.insert(requestDeduplications).values({ id: crypto.randomUUID(), ownerId: user.userId, idempotencyKey: parsed.data.idempotencyKey, resourceType: 'profile_onboarding', resourceId: 'current', createdAt: now }),
    ]);
  } catch {
    return Response.json({ error: 'We could not save onboarding. Please try again.' }, { status: 500 });
  }
  return Response.json({ draft: parsed.data.draft, status, updatedAt: now.toISOString(), replayed: false }, { headers: { 'Cache-Control': 'no-store' } });
}
