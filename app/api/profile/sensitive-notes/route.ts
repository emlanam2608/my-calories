import { and, eq } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { profileSensitiveNotes, requestDeduplications } from '@/db/schema';
import {
  sensitiveNotesResponseSchema,
  sensitiveNotesSchema,
  updateSensitiveNotesRequestSchema,
} from '@/lib/contracts';
import {
  configuredHealthNoteEncryption,
  decryptHealthNotes,
  encryptHealthNotes,
  HealthNoteEncryptionError,
  type EncryptedHealthNotes,
} from '@/lib/health-note-encryption';

async function notesForOwner(ownerId: string) {
  const config = configuredHealthNoteEncryption();
  if (!config)
    throw new HealthNoteEncryptionError('Encrypted health notes are not configured.');
  const row = await getDb()
    .select()
    .from(profileSensitiveNotes)
    .where(eq(profileSensitiveNotes.ownerId, ownerId))
    .limit(1);
  if (!row[0])
    return sensitiveNotesResponseSchema.parse({
      notes: sensitiveNotesSchema.parse({}),
      updatedAt: null,
    });
  const notes = await decryptHealthNotes(
    row[0].ciphertext as EncryptedHealthNotes,
    config,
  );
  return sensitiveNotesResponseSchema.parse({
    notes,
    updatedAt: row[0].updatedAt.toISOString(),
  });
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  try {
    return Response.json(await notesForOwner(user.userId), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof HealthNoteEncryptionError ? error.message : 'Encrypted health notes could not be read.' },
      { status: 503 },
    );
  }
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const parsed = updateSensitiveNotesRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json({ error: 'Review the encrypted-health-note fields and try again.' }, { status: 400 });
  const config = configuredHealthNoteEncryption();
  if (!config)
    return Response.json({ error: 'Encrypted health notes are not configured.' }, { status: 503 });
  const db = getDb();
  const duplicate = await db
    .select({ resourceType: requestDeduplications.resourceType })
    .from(requestDeduplications)
    .where(and(eq(requestDeduplications.ownerId, user.userId), eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey)))
    .limit(1);
  if (duplicate[0]) {
    if (duplicate[0].resourceType !== 'profile_sensitive_notes')
      return Response.json({ error: 'This idempotency key has already been used for a different request.' }, { status: 409 });
    try {
      return Response.json({ ...(await notesForOwner(user.userId)), replayed: true }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return Response.json({ error: error instanceof HealthNoteEncryptionError ? error.message : 'Encrypted health notes could not be read.' }, { status: 503 });
    }
  }
  const now = new Date();
  try {
    const ciphertext = await encryptHealthNotes(parsed.data.notes, config);
    await db.batch([
      db.insert(profileSensitiveNotes)
        .values({ id: crypto.randomUUID(), ownerId: user.userId, ciphertext, keyVersion: config.keyVersion, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({ target: profileSensitiveNotes.ownerId, set: { ciphertext, keyVersion: config.keyVersion, updatedAt: now } }),
      db.insert(requestDeduplications).values({ id: crypto.randomUUID(), ownerId: user.userId, idempotencyKey: parsed.data.idempotencyKey, resourceType: 'profile_sensitive_notes', resourceId: 'current', createdAt: now }),
    ]);
  } catch {
    return Response.json({ error: 'Encrypted health notes could not be saved. Please try again.' }, { status: 500 });
  }
  return Response.json(
    sensitiveNotesResponseSchema.parse({ notes: parsed.data.notes, updatedAt: now.toISOString() }),
    { headers: { 'Cache-Control': 'no-store' }, status: 200 },
  );
}
