import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMigratedRouteDb } from './private-route-test-harness';

const mocks = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('@/db', () => ({ getDb: () => mocks.db }));

const { findCloudflareAccessOwner } =
  await import('./cloudflare-access-identity');

describe('Cloudflare Access identity mapping', () => {
  beforeEach(() => {
    mocks.db = undefined;
  });

  it('resolves only the exact verified provider, issuer, and subject', async () => {
    const routeDb = await createMigratedRouteDb();
    mocks.db = routeDb.db;
    try {
      await routeDb.database
        .prepare(
          'insert into auth_identities (id, owner_id, provider, issuer, subject, email_at_link, linked_at) values (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          'identity-owner-a',
          'existing-owner-id',
          'cloudflare_access',
          'https://nourishwell.cloudflareaccess.com',
          'access-owner-subject',
          'owner@example.test',
          Date.now(),
        )
        .run();

      await expect(
        findCloudflareAccessOwner({
          email: 'new-address@example.test',
          issuer: 'https://nourishwell.cloudflareaccess.com',
          subject: 'access-owner-subject',
        }),
      ).resolves.toEqual({ ownerId: 'existing-owner-id' });
      await expect(
        findCloudflareAccessOwner({
          email: 'owner@example.test',
          issuer: 'https://nourishwell.cloudflareaccess.com',
          subject: 'different-subject',
        }),
      ).resolves.toBeNull();
    } finally {
      mocks.db = undefined;
      await routeDb.dispose();
    }
  }, 60_000);

  it('enforces a unique identity tuple and the bounded provider', async () => {
    const routeDb = await createMigratedRouteDb();
    try {
      const insert = (id: string, provider = 'cloudflare_access') =>
        routeDb.database
          .prepare(
            'insert into auth_identities (id, owner_id, provider, issuer, subject, email_at_link, linked_at) values (?, ?, ?, ?, ?, ?, ?)',
          )
          .bind(
            id,
            'existing-owner-id',
            provider,
            'https://nourishwell.cloudflareaccess.com',
            'access-owner-subject',
            'owner@example.test',
            Date.now(),
          )
          .run();
      await insert('identity-owner-a');
      await expect(insert('identity-duplicate')).rejects.toThrow();
      await expect(insert('identity-unsupported', 'email')).rejects.toThrow();
    } finally {
      await routeDb.dispose();
    }
  }, 60_000);
});
