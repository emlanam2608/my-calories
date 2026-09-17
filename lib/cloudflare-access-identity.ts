import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { authIdentities } from '@/db/schema';
import {
  cloudflareAccessProvider,
  type VerifiedCloudflareAccessIdentity,
} from './cloudflare-access-auth';

/**
 * Resolves an already verified Access identity to the app's stable owner ID.
 * Email is deliberately absent from the predicate so it cannot link accounts.
 */
export async function findCloudflareAccessOwner(
  identity: VerifiedCloudflareAccessIdentity,
): Promise<{ ownerId: string } | null> {
  const rows = await getDb()
    .select({ ownerId: authIdentities.ownerId })
    .from(authIdentities)
    .where(
      and(
        eq(authIdentities.provider, cloudflareAccessProvider),
        eq(authIdentities.issuer, identity.issuer),
        eq(authIdentities.subject, identity.subject),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
