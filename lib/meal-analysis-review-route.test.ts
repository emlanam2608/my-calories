import { beforeEach, describe, expect, it, vi } from 'vitest';
import { analyseTypedFood } from './food-analysis';
import {
  createMigratedRouteDb,
  privateRouteRequest,
  routeTestUsers,
} from './private-route-test-harness';

const mocks = vi.hoisted(() => ({
  db: undefined as unknown,
  user: null as typeof routeTestUsers.ownerA | typeof routeTestUsers.ownerB | null,
}));

vi.mock('@/app/chatgpt-auth', () => ({ getChatGPTUser: async () => mocks.user }));
vi.mock('@/db', () => ({ getDb: () => mocks.db }));
vi.mock('cloudflare:workers', () => ({ env: {} }));

const [{ POST: analyseMeal }, { POST: reviewMeal }, { POST: confirmMeal }] =
  await Promise.all([
    import('@/app/api/meals/analyse/route'),
    import('@/app/api/meals/review/route'),
    import('@/app/api/meals/route'),
  ]);

async function withDatabase(
  run: (
    routeDb: Awaited<ReturnType<typeof createMigratedRouteDb>>,
  ) => Promise<void>,
) {
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

async function issueAnalysisReview() {
  const response = await analyseMeal(
    privateRouteRequest('/api/meals/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'text', text: 'pho bo' }),
    }),
  );
  expect(response.status).toBe(200);
  return (await response.json()) as {
    analysis: {
      serverReview: { id: string; expiresAt: string };
      snapshot: { totals: { sodium: number } };
      healthFindings: Array<{ ruleCode: string }>;
    };
  };
}

function confirmationRequest(reviewId: string, idempotencyKey = crypto.randomUUID()) {
  return privateRouteRequest('/api/meals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey,
      reviewId,
      occurredAt: '2026-09-02T05:00:00.000Z',
    }),
  });
}

describe('server-issued meal analysis reviews', () => {
  beforeEach(() => {
    mocks.db = undefined;
    mocks.user = routeTestUsers.ownerA;
  });

  it('requires authentication for review issuance and meal confirmation', async () => {
    mocks.user = null;
    const draft = analyseTypedFood('rice');
    const reviewResponse = await reviewMeal(privateRouteRequest('/api/meals/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysis: draft }),
    }, null));
    const confirmationResponse = await confirmMeal(confirmationRequest(crypto.randomUUID()));
    expect(reviewResponse.status).toBe(401);
    expect(confirmationResponse.status).toBe(401);
  });

  it('recomputes edited facts server-side and never accepts client findings', async () => withDatabase(async () => {
    const draft = analyseTypedFood('rice');
    const response = await reviewMeal(privateRouteRequest('/api/meals/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analysis: {
          ...draft,
          snapshot: {
            ...draft.snapshot,
            totals: { ...draft.snapshot.totals, sodium: 900 },
          },
          healthFindings: [{ ruleCode: 'client-invented' }],
        },
      }),
    }));
    expect(response.status).toBe(200);
    const body = await response.json() as {
      analysis: {
        serverReview: { id: string };
        healthFindings: Array<{ ruleCode: string }>;
      };
    };
    expect(body.analysis.serverReview.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.analysis.healthFindings.map((finding) => finding.ruleCode))
      .toContain('meal-sodium-800mg');
    expect(body.analysis.healthFindings.map((finding) => finding.ruleCode))
      .not.toContain('client-invented');

    const legacyPayload = await confirmMeal(privateRouteRequest('/api/meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        occurredAt: '2026-09-02T05:00:00.000Z',
        name: 'Client meal',
        mealType: 'lunch',
        nutritionSnapshot: draft.snapshot,
        healthFindings: [],
      }),
    }));
    expect(legacyPayload.status).toBe(400);
  }), 60_000);

  it('rejects wrong-owner, expired, and context-stale reviews', async () => withDatabase(async ({ database }) => {
    const wrongOwnerReview = await issueAnalysisReview();
    mocks.user = routeTestUsers.ownerB;
    expect((await confirmMeal(confirmationRequest(wrongOwnerReview.analysis.serverReview.id))).status).toBe(404);

    mocks.user = routeTestUsers.ownerA;
    const expiredReview = await issueAnalysisReview();
    await database.prepare('update meal_analysis_reviews set expires_at = 0 where id = ?')
      .bind(expiredReview.analysis.serverReview.id).run();
    expect((await confirmMeal(confirmationRequest(expiredReview.analysis.serverReview.id))).status).toBe(410);

    const staleReview = await issueAnalysisReview();
    const now = Date.now();
    await database.prepare('insert into health_focuses (id, owner_id, focus, created_at, updated_at) values (?, ?, ?, ?, ?)')
      .bind('new-focus', routeTestUsers.ownerA.userId, 'blood_pressure', now, now).run();
    const staleResponse = await confirmMeal(confirmationRequest(staleReview.analysis.serverReview.id));
    expect(staleResponse.status).toBe(409);
    await expect(staleResponse.json()).resolves.toMatchObject({
      error: expect.stringContaining('changed'),
    });
  }), 60_000);

  it('persists exactly the server review, consumes it once, and replays only the original mutation', async () => withDatabase(async ({ database }) => {
    const issued = await issueAnalysisReview();
    const key = crypto.randomUUID();
    const first = await confirmMeal(confirmationRequest(issued.analysis.serverReview.id, key));
    expect(first.status).toBe(201);
    const firstBody = await first.json() as { id: string; replayed: boolean };
    expect(firstBody.replayed).toBe(false);

    const stored = await database.prepare('select nutrition_snapshot, health_findings, review_id from meal_entries where id = ?')
      .bind(firstBody.id).first<{ nutrition_snapshot: string; health_findings: string; review_id: string }>();
    expect(stored?.review_id).toBe(issued.analysis.serverReview.id);
    expect(JSON.parse(stored!.nutrition_snapshot)).toEqual(issued.analysis.snapshot);
    expect(JSON.parse(stored!.health_findings)).toEqual(issued.analysis.healthFindings);
    const review = await database.prepare('select consumed_at from meal_analysis_reviews where id = ?')
      .bind(issued.analysis.serverReview.id).first<{ consumed_at: number | null }>();
    expect(review?.consumed_at).not.toBeNull();

    const replay = await confirmMeal(confirmationRequest(issued.analysis.serverReview.id, key));
    expect(replay.status).toBe(200);
    await expect(replay.json()).resolves.toEqual({ id: firstBody.id, replayed: true });

    const secondKey = await confirmMeal(confirmationRequest(issued.analysis.serverReview.id));
    expect(secondKey.status).toBe(409);
    const count = await database.prepare('select count(*) as count from meal_entries where review_id = ?')
      .bind(issued.analysis.serverReview.id).first<{ count: number }>();
    expect(count?.count).toBe(1);
  }), 60_000);
});
