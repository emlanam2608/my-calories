import { and, eq, lt } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { getDb } from '@/db';
import { uploads } from '@/db/schema';
import { cleanExpiredUploads } from './upload-cleanup';

const cleanupBatchSize = 25;

/**
 * Opportunistic cleanup keeps transient health images short-lived until the
 * scheduled worker is provisioned. Failures stay pending for a safe retry.
 */
export async function cleanExpiredPrivateUploads() {
  const now = new Date();
  const rows = await getDb()
    .select({ id: uploads.id, storageKey: uploads.storageKey })
    .from(uploads)
    .where(and(eq(uploads.status, 'pending'), lt(uploads.expiresAt, now)))
    .limit(cleanupBatchSize);
  return cleanExpiredUploads(
    rows,
    (storageKey) => env.FILES.delete(storageKey),
    (id) =>
      getDb()
        .update(uploads)
        .set({ status: 'expired', deletedAt: now })
        .where(and(eq(uploads.id, id), eq(uploads.status, 'pending')))
        .then(() => undefined),
  );
}
