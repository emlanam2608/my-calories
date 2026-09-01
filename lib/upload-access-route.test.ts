import { createFakePrivateObjects, createFakeRouteDb, privateRouteRequest, routeTestUsers } from './private-route-test-harness';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: undefined as unknown,
  user: null as { userId: string; displayName: string; email: string; fullName: string | null } | null,
  env: { FILES: undefined as unknown },
}));

vi.mock('@/app/chatgpt-auth', () => ({ getChatGPTUser: async () => mocks.user }));
vi.mock('@/db', () => ({ getDb: () => mocks.db }));
vi.mock('cloudflare:workers', () => ({ env: mocks.env }));
vi.mock('@/lib/upload-expiry-cleanup', () => ({ cleanExpiredPrivateUploads: async () => undefined }));

const { GET } = await import('@/app/api/uploads/[id]/route');
const uploadId = '018e2aaa-6a86-4d9d-b36a-a3d96fd0d0c1';

function uploadRow(ownerId = routeTestUsers.ownerA.userId) {
  return {
    id: uploadId,
    ownerId,
    storageKey: `uploads/${uploadId}.png`,
    kind: 'meal_photo',
    contentType: 'image/png',
    byteSize: 3,
    width: 32,
    height: 32,
    status: 'pending',
    expiresAt: new Date('2026-12-01T00:00:00.000Z'),
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    deletedAt: null,
  };
}

describe('private upload access route', () => {
  beforeEach(() => {
    mocks.user = routeTestUsers.ownerA;
    mocks.db = undefined;
    mocks.env.FILES = undefined;
  });

  it('rejects anonymous retrieval before querying the database', async () => {
    mocks.user = null;
    const response = await GET(privateRouteRequest(`/api/uploads/${uploadId}`, {}, null), { params: Promise.resolve({ id: uploadId }) });
    expect(response.status).toBe(401);
    expect(mocks.db).toBeUndefined();
  });

  it('does not read a private object when the owner-scoped upload lookup is empty', async () => {
    const database = createFakeRouteDb();
    const objects = createFakePrivateObjects();
    mocks.db = database.db;
    mocks.env.FILES = objects.FILES;
    const response = await GET(privateRouteRequest(`/api/uploads/${uploadId}`), { params: Promise.resolve({ id: uploadId }) });
    expect(response.status).toBe(404);
    expect(objects.getCalls).toEqual([]);
  });

  it('returns only the authenticated owner upload through private no-store storage', async () => {
    const row = uploadRow();
    const database = createFakeRouteDb([row]);
    const objects = createFakePrivateObjects({ [row.storageKey]: new Uint8Array([1, 2, 3]) });
    mocks.db = database.db;
    mocks.env.FILES = objects.FILES;
    const response = await GET(privateRouteRequest(`/api/uploads/${uploadId}`), { params: Promise.resolve({ id: uploadId }) });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([1, 2, 3]);
  });
});
