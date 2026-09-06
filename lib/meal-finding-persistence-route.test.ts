import { createMigratedRouteDb, privateRouteRequest, routeTestUsers } from './private-route-test-harness';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: undefined as unknown,
  user: null as { userId: string; displayName: string; email: string; fullName: string | null } | null,
}));

vi.mock('@/app/chatgpt-auth', () => ({ getChatGPTUser: async () => mocks.user }));
vi.mock('@/db', () => ({ getDb: () => mocks.db }));
vi.mock('cloudflare:workers', () => ({ env: {} }));

const [{ POST: analyseMeal }, { GET: getMeals, POST: postMeal }] = await Promise.all([
  import('@/app/api/meals/analyse/route'),
  import('@/app/api/meals/route'),
]);

const now = new Date('2026-09-01T05:00:00.000Z').getTime();

async function withDatabase(run: (database: Awaited<ReturnType<typeof createMigratedRouteDb>>) => Promise<void>) {
  const routeDb = await createMigratedRouteDb();
  mocks.db = routeDb.db;
  mocks.user = routeTestUsers.ownerA;
  try {
    await run(routeDb);
  } finally {
    mocks.db = undefined;
    mocks.user = routeTestUsers.ownerA;
    await routeDb.dispose();
  }
}

describe('immutable meal finding snapshots', () => {
  beforeEach(() => { mocks.db = undefined; mocks.user = routeTestUsers.ownerA; });

  it('uses the owner effective target during analysis, then persists and replays the reviewed findings unchanged', async () => withDatabase(async ({ database }) => {
    await database.prepare('insert into health_targets (id, owner_id, metric, value_scaled, value_scale, unit, authority, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)').bind(
      'target-sodium-clinician', routeTestUsers.ownerA.userId, 'sodium', 150000, 100, 'mg', 'clinician_defined', now,
    ).run();
    await database.prepare('insert into health_focuses (id, owner_id, focus, created_at, updated_at) values (?, ?, ?, ?, ?)').bind(
      'focus-bp', routeTestUsers.ownerA.userId, 'blood_pressure', now, now,
    ).run();

    const analysisResponse = await analyseMeal(privateRouteRequest('/api/meals/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'text', text: 'pho bo' }),
    }));
    expect(analysisResponse.status).toBe(200);
    const analysisBody = await analysisResponse.json() as { analysis: { serverReview: { id: string }; healthFindings: Array<Record<string, unknown>> } };
    expect(analysisBody.analysis.healthFindings).toEqual([
      expect.objectContaining({
        ruleCode: 'meal-sodium-800mg',
        targetMetric: 'sodium',
        targetValue: 1500,
        targetUnit: 'mg',
        targetAuthority: 'clinician_defined',
        presentationVersion: 'health-finding-presentation-1',
        text: expect.objectContaining({ en: expect.any(String), vi: expect.any(String) }),
      }),
    ]);

    const idempotencyKey = '018e2aaa-6a86-4d9d-b36a-a3d96fd0d101';
    const reviewedFindings = analysisBody.analysis.healthFindings;
    const payload = {
      idempotencyKey,
      reviewId: analysisBody.analysis.serverReview.id,
      occurredAt: '2026-09-01T05:00:00.000Z',
    };
    const saved = await postMeal(privateRouteRequest('/api/meals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }));
    expect(saved.status).toBe(201);
    const savedBody = await saved.json() as { id: string };

    await database.prepare('update health_targets set value_scaled = ? where id = ?').bind(90000, 'target-sodium-clinician').run();
    const replay = await postMeal(privateRouteRequest('/api/meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }));
    await expect(replay.json()).resolves.toEqual({ id: savedBody.id, replayed: true });

    const response = await getMeals(privateRouteRequest('/api/meals?date=2026-09-01'));
    const body = await response.json() as { meals: Array<{ healthFindings: unknown[] }> };
    expect(body.meals).toHaveLength(1);
    expect(body.meals[0].healthFindings).toEqual(reviewedFindings);
  }), 60_000);

  it('does not return malformed stored findings or another owner meal', async () => withDatabase(async ({ database }) => {
    const snapshot = JSON.stringify({
      totals: { calories: 400, protein: 20, fiber: 3, sodium: 500 },
      servingDescription: '1 serving', source: 'manual_entry', sourceVersion: 'test',
      sourceReference: null, estimationLevel: 'user_confirmed', ingredients: ['rice'],
    });
    await database.prepare('insert into meal_entries (id, owner_id, occurred_at, meal_type, name, nutrition_snapshot, health_findings, analysis_source, confidence, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(
      'meal-malformed', routeTestUsers.ownerA.userId, now, 'lunch', 'Malformed', snapshot, JSON.stringify({ bad: true }), 'manual_entry', 100, now,
    ).run();
    await database.prepare('insert into meal_entries (id, owner_id, occurred_at, meal_type, name, nutrition_snapshot, health_findings, analysis_source, confidence, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(
      'meal-owner-b', routeTestUsers.ownerB.userId, now, 'lunch', 'Owner B', snapshot, JSON.stringify([]), 'manual_entry', 100, now,
    ).run();

    const response = await getMeals(privateRouteRequest('/api/meals?date=2026-09-01'));
    await expect(response.json()).resolves.toEqual({ meals: [] });
  }), 60_000);
});
