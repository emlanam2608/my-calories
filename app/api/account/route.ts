import { eq } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import {
  aiExecutions,
  healthFocuses,
  healthTargets,
  mealEntries,
  measurements,
  profileOnboarding,
  profileSensitiveNotes,
  profiles,
  reminders,
  requestDeduplications,
  savedFoods,
  uploads,
  workoutCheckins,
  workoutPlans,
  workoutReadiness,
  workoutSessions,
} from '@/db/schema';
import { accountDeletionRequestSchema } from '@/lib/contracts';
import { assertOwnerDataInventory } from '@/lib/owner-data-inventory';

/**
 * Permanently removes every owner-scoped record and every private R2 object.
 * No deletion receipt is retained because that would itself be account data.
 */
export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const parsed = accountDeletionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Type DELETE MY DATA to permanently remove your private account data.' }, { status: 400 });

  const db = getDb();
  const privateUploads = await db.select({ storageKey: uploads.storageKey }).from(uploads).where(eq(uploads.ownerId, user.userId));
  try {
    for (const upload of privateUploads) await env.FILES.delete(upload.storageKey);
  } catch {
    return Response.json({ error: 'Private file deletion could not finish. No database records were removed; please try again.' }, { status: 503 });
  }

  const deletions = {
    profile: db.delete(profiles).where(eq(profiles.ownerId, user.userId)),
    healthTargets: db.delete(healthTargets).where(eq(healthTargets.ownerId, user.userId)),
    onboarding: db.delete(profileOnboarding).where(eq(profileOnboarding.ownerId, user.userId)),
    sensitiveNotes: db.delete(profileSensitiveNotes).where(eq(profileSensitiveNotes.ownerId, user.userId)),
    uploads: db.delete(uploads).where(eq(uploads.ownerId, user.userId)),
    aiExecutions: db.delete(aiExecutions).where(eq(aiExecutions.ownerId, user.userId)),
    savedFoods: db.delete(savedFoods).where(eq(savedFoods.ownerId, user.userId)),
    healthFocuses: db.delete(healthFocuses).where(eq(healthFocuses.ownerId, user.userId)),
    meals: db.delete(mealEntries).where(eq(mealEntries.ownerId, user.userId)),
    measurements: db.delete(measurements).where(eq(measurements.ownerId, user.userId)),
    workoutSessions: db.delete(workoutSessions).where(eq(workoutSessions.ownerId, user.userId)),
    workoutReadiness: db.delete(workoutReadiness).where(eq(workoutReadiness.ownerId, user.userId)),
    workoutPlans: db.delete(workoutPlans).where(eq(workoutPlans.ownerId, user.userId)),
    workoutCheckins: db.delete(workoutCheckins).where(eq(workoutCheckins.ownerId, user.userId)),
    reminders: db.delete(reminders).where(eq(reminders.ownerId, user.userId)),
    requestDeduplications: db.delete(requestDeduplications).where(eq(requestDeduplications.ownerId, user.userId)),
  };
  assertOwnerDataInventory(Object.keys(deletions));
  try {
    await db.batch([
      deletions.profile,
      deletions.healthTargets,
      deletions.onboarding,
      deletions.sensitiveNotes,
      deletions.uploads,
      deletions.aiExecutions,
      deletions.savedFoods,
      deletions.healthFocuses,
      deletions.meals,
      deletions.measurements,
      deletions.workoutSessions,
      deletions.workoutReadiness,
      deletions.workoutPlans,
      deletions.workoutCheckins,
      deletions.reminders,
      deletions.requestDeduplications,
    ]);
  } catch {
    return Response.json({ error: 'Private files were removed, but account records could not be removed. Please retry deletion.' }, { status: 503 });
  }
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
