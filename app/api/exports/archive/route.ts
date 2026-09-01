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
  savedFoods,
  uploads,
  workoutCheckins,
  workoutPlans,
  workoutReadiness,
  workoutSessions,
} from '@/db/schema';
import {
  accountArchiveFilename,
  accountArchiveFormat,
  archiveUploadLimitBytes,
  archiveUploadLimitCount,
  archiveUploadPreflight,
  bytesToArchiveBase64,
} from '@/lib/account-archive';
import {
  configuredHealthNoteEncryption,
  decryptHealthNotes,
  type EncryptedHealthNotes,
} from '@/lib/health-note-encryption';
import { assertPublicArchiveOwnerDataInventory } from '@/lib/owner-data-inventory';

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const db = getDb();
  const [
    profile, targets, onboarding, encryptedNotes, ownerUploads, executions,
    foods, focuses, meals, values, sessions, readiness, plans, checkins,
    ownerReminders,
  ] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.ownerId, user.userId)),
    db.select().from(healthTargets).where(eq(healthTargets.ownerId, user.userId)),
    db.select().from(profileOnboarding).where(eq(profileOnboarding.ownerId, user.userId)),
    db.select().from(profileSensitiveNotes).where(eq(profileSensitiveNotes.ownerId, user.userId)),
    db.select().from(uploads).where(eq(uploads.ownerId, user.userId)),
    db.select().from(aiExecutions).where(eq(aiExecutions.ownerId, user.userId)),
    db.select().from(savedFoods).where(eq(savedFoods.ownerId, user.userId)),
    db.select().from(healthFocuses).where(eq(healthFocuses.ownerId, user.userId)),
    db.select().from(mealEntries).where(eq(mealEntries.ownerId, user.userId)),
    db.select().from(measurements).where(eq(measurements.ownerId, user.userId)),
    db.select().from(workoutSessions).where(eq(workoutSessions.ownerId, user.userId)),
    db.select().from(workoutReadiness).where(eq(workoutReadiness.ownerId, user.userId)),
    db.select().from(workoutPlans).where(eq(workoutPlans.ownerId, user.userId)),
    db.select().from(workoutCheckins).where(eq(workoutCheckins.ownerId, user.userId)),
    db.select().from(reminders).where(eq(reminders.ownerId, user.userId)),
  ]);

  const preflight = archiveUploadPreflight(ownerUploads);
  if (!preflight.allowed) {
    return Response.json(
      {
        error: 'This archive is too large to prepare safely right now. Download CSV/PDF reports or remove unneeded retained images, then try again.',
        limit: { uploadBytes: archiveUploadLimitBytes, uploadCount: archiveUploadLimitCount },
      },
      { status: 413, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const healthNoteConfig = configuredHealthNoteEncryption();
  const sensitiveNotes = encryptedNotes[0] && healthNoteConfig
    ? await decryptHealthNotes(encryptedNotes[0].ciphertext as EncryptedHealthNotes, healthNoteConfig).catch(() => null)
    : null;
  const archiveUploads = await Promise.all(ownerUploads.map(async (upload) => {
    const object = upload.status === 'deleted' || upload.status === 'expired'
      ? null
      : await env.FILES.get(upload.storageKey);
    const unavailableReason = upload.status === 'deleted' || upload.status === 'expired'
      ? upload.status
      : object ? null : 'missing';
    return {
      id: upload.id,
      kind: upload.kind,
      contentType: upload.contentType,
      byteSize: upload.byteSize,
      width: upload.width,
      height: upload.height,
      status: upload.status,
      createdAt: upload.createdAt,
      expiresAt: upload.expiresAt,
      deletedAt: upload.deletedAt,
      content: object
        ? { state: 'included', encoding: 'base64', data: bytesToArchiveBase64(new Uint8Array(await object.arrayBuffer())) }
        : { state: 'unavailable', reason: unavailableReason },
    };
  }));
  const records = {
    profile, healthTargets: targets, onboarding, uploads: archiveUploads,
    aiExecutions: executions, savedFoods: foods, healthFocuses: focuses,
    meals, measurements: values, workoutSessions: sessions, workoutReadiness: readiness,
    workoutPlans: plans, workoutCheckins: checkins, reminders: ownerReminders,
  };
  assertPublicArchiveOwnerDataInventory([
    'profile', 'healthTargets', 'onboarding', 'sensitiveNotes', 'uploads', 'aiExecutions',
    'savedFoods', 'healthFocuses', 'meals', 'measurements', 'workoutSessions',
    'workoutReadiness', 'workoutPlans', 'workoutCheckins', 'reminders',
  ]);
  const archive = {
    format: accountArchiveFormat,
    exportedAt: new Date().toISOString(),
    timezone: 'Asia/Bangkok',
    sensitiveNotes: sensitiveNotes
      ? { format: 'plaintext-health-notes-v1', value: sensitiveNotes }
      : { format: 'encrypted-health-notes-v1', value: encryptedNotes },
    records,
  };
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return new Response(JSON.stringify(archive, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${accountArchiveFilename(date)}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
