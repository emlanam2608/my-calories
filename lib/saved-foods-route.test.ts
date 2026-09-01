import { requestDeduplications, savedFoods } from '@/db/schema';
import { createFakeRouteDb, createMigratedRouteDb, privateRouteRequest, routeTestUsers } from './private-route-test-harness';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: undefined as unknown,
  user: null as { userId: string; displayName: string; email: string; fullName: string | null } | null,
}));

vi.mock('@/app/chatgpt-auth', () => ({ getChatGPTUser: async () => mocks.user }));
vi.mock('@/db', () => ({ getDb: () => mocks.db }));

const { GET, POST } = await import('@/app/api/saved-foods/route');
const idempotencyKey = '018e2aaa-6a86-4d9d-b36a-a3d96fd0d0c2';

function savedFoodRow() {
  return {
    id: '018e2aaa-6a86-4d9d-b36a-a3d96fd0d0c1',
    ownerId: routeTestUsers.ownerA.userId,
    kind: 'food',
    name: 'Chicken rice',
    nameVi: 'Cơm gà',
    normalizedName: 'com ga',
    nutritionSnapshot: {
      totals: { calories: 500, protein: 28, fiber: 3, sodium: 800 },
      servingDescription: '1 bowl',
      source: 'manual_entry',
      sourceVersion: 'user-1',
      sourceReference: null,
      estimationLevel: 'user_confirmed',
      ingredients: ['rice', 'chicken'],
    },
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  };
}

function postRequest() {
  return privateRouteRequest('/api/saved-foods', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idempotencyKey, kind: 'food', name: 'Chicken rice', nameVi: 'Cơm gà', nutritionSnapshot: savedFoodRow().nutritionSnapshot }),
  });
}

describe('saved foods route security and replay', () => {
  beforeEach(() => {
    mocks.user = routeTestUsers.ownerA;
    mocks.db = undefined;
  });

  it('rejects anonymous reads before accessing saved-food rows', async () => {
    mocks.user = null;
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mocks.db).toBeUndefined();
  });

  it('returns only the rows visible to the authenticated owner', async () => {
    const visible = savedFoodRow();
    const database = createFakeRouteDb({ rowsByTable: new Map([[savedFoods, [visible]]]) });
    mocks.db = database.db;
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ savedFoods: [{ id: visible.id, kind: 'food', name: 'Chicken rice', nameVi: 'Cơm gà', nutritionSnapshot: visible.nutritionSnapshot, updatedAt: visible.updatedAt.toISOString() }] });
  });

  it('uses a clean migrated D1 database for an owner-scoped saved-food read', async () => {
    const routeDb = await createMigratedRouteDb();
    const visible = savedFoodRow();
    try {
      await routeDb.db.insert(savedFoods).values(visible);
      mocks.db = routeDb.db;
      const response = await GET();
      await expect(response.json()).resolves.toMatchObject({ savedFoods: [{ id: visible.id, name: visible.name }] });
    } finally {
      await routeDb.dispose();
    }
  }, 60_000);

  it('returns no records when an owner-scoped saved-food query has no visible rows', async () => {
    mocks.db = createFakeRouteDb({ rowsByTable: new Map([[savedFoods, []]]) }).db;
    const response = await GET();
    await expect(response.json()).resolves.toEqual({ savedFoods: [] });
  });

  it('rejects idempotency keys that were used for another resource', async () => {
    mocks.db = createFakeRouteDb({ rowsByTable: new Map([[requestDeduplications, [{ resourceId: savedFoodRow().id, resourceType: 'measurement' }]]]) }).db;
    const response = await POST(postRequest());
    expect(response.status).toBe(409);
  });

  it('returns the saved-food replay identifier without creating another row', async () => {
    const row = savedFoodRow();
    mocks.db = createFakeRouteDb({ rowsByTable: new Map([[requestDeduplications, [{ resourceId: row.id, resourceType: 'saved_food' }]]]) }).db;
    const response = await POST(postRequest());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: row.id, replayed: true });
  });
});
