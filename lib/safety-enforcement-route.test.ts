import { createMigratedRouteDb, privateRouteRequest, routeTestUsers } from './private-route-test-harness';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('@/app/chatgpt-auth', () => ({ getChatGPTUser: async () => routeTestUsers.ownerA }));
vi.mock('@/db', () => ({ getDb: () => mocks.db }));

const [{ POST: previewPlan }, { POST: confirmPlan }, { GET: getCheckin, POST: postCheckin }] = await Promise.all([
  import('@/app/api/workout-plans/preview/route'),
  import('@/app/api/workout-plans/route'),
  import('@/app/api/workout-checkins/route'),
]);

const adultDraft = {
  goal: 'fitness', heightCm: 170, ageYears: 34,
  sexForMetabolicCalculation: 'not_specified', pregnancyContext: 'not_applicable',
  activityLevel: 'light', trainingHistory: 'beginner',
  availableDays: ['mon', 'wed', 'fri'],
  equipment: ['chair', 'exercise_mat', 'bicycle', 'mini_treadmill'], environments: ['home'],
  clinicianRestrictionFlags: [], medicationExerciseRiskFlags: [], symptomFlags: ['none'],
};

async function withDatabase(run: (routeDb: Awaited<ReturnType<typeof createMigratedRouteDb>>) => Promise<void>) {
  const routeDb = await createMigratedRouteDb();
  mocks.db = routeDb.db;
  try { await run(routeDb); } finally { mocks.db = undefined; await routeDb.dispose(); }
}

async function seedClearedOwner(database: Awaited<ReturnType<typeof createMigratedRouteDb>>['database']) {
  const now = Date.now();
  await database.prepare('insert into profile_onboarding (id, owner_id, draft, status, created_at, updated_at) values (?, ?, ?, ?, ?, ?)').bind('onboarding-owner-a', routeTestUsers.ownerA.userId, JSON.stringify(adultDraft), 'complete', now, now).run();
  await database.prepare('insert into workout_readiness (id, owner_id, chest_pain, fainting_or_dizziness, severe_shortness_of_breath, irregular_heartbeat, clinician_restriction, exercise_glucose_risk, status, confirmed_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('readiness-owner-a', routeTestUsers.ownerA.userId, 0, 0, 0, 0, 0, 0, 'cleared', now, now).run();
}

describe('effective safety enforcement routes', () => {
  beforeEach(() => { mocks.db = undefined; });

  it('allows a cleared preview and returns stable bilingual reason keys when later blocked', async () => withDatabase(async ({ database }) => {
    await seedClearedOwner(database);
    const allowed = await previewPlan();
    expect(allowed.status).toBe(200);
    await database.prepare('update profile_onboarding set draft = ?, updated_at = ? where owner_id = ?').bind(JSON.stringify({ ...adultDraft, ageYears: 17 }), Date.now(), routeTestUsers.ownerA.userId).run();
    const blocked = await previewPlan();
    expect(blocked.status).toBe(422);
    await expect(blocked.json()).resolves.toMatchObject({
      errorCode: 'exercise_recommendation_blocked',
      domain: 'workout_plan',
      contextVersion: 'effective-safety-context-1',
      reasons: [{ code: 'under_18', copyKey: 'safetyContext.reasons.under_18' }],
    });
  }), 60_000);

  it('re-resolves safety at confirmation so a stale preview cannot bypass a new block', async () => withDatabase(async ({ database }) => {
    await seedClearedOwner(database);
    const preview = await previewPlan();
    const plan = (await preview.json()) as { previewId: string };
    await database.prepare('update profile_onboarding set draft = ?, updated_at = ? where owner_id = ?').bind(JSON.stringify({ ...adultDraft, pregnancyContext: 'pregnant' }), Date.now(), routeTestUsers.ownerA.userId).run();
    const response = await confirmPlan(privateRouteRequest('/api/workout-plans', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: '018e2aaa-6a86-4d9d-b36a-a3d96fd00d91', previewId: plan.previewId }),
    }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'workout_plan_preview_stale' });
    const stored = await database.prepare('select count(*) as count from workout_plans where owner_id = ?').bind(routeTestUsers.ownerA.userId).first<{ count: number }>();
    expect(stored?.count).toBe(0);
  }), 60_000);

  it('stores the resolved progression decision and reason codes with an idempotent check-in', async () => withDatabase(async ({ database }) => {
    await seedClearedOwner(database);
    const preview = await previewPlan();
    const body = (await preview.json()) as { previewId: string; plan: { sessions: Array<{ id: string }> } };
    const confirmation = await confirmPlan(privateRouteRequest('/api/workout-plans', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: '018e2aaa-6a86-4d9d-b36a-a3d96fd00d92', previewId: body.previewId }),
    }));
    expect(confirmation.status).toBe(200);
    const confirmed = await confirmation.json() as { plan: { id: string } };
    const planId = confirmed.plan.id;
    const now = Date.now();
    await database.prepare('insert into workout_sessions (id, owner_id, plan_id, session_id, plan_version, status, duration_minutes, rpe, pain, concerning_symptoms, pre_glucose_scaled, glucose_scale, completed_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('log-owner-a', routeTestUsers.ownerA.userId, planId, body.plan.sessions[0].id, 'workout-plan-v2', 'completed', 20, 4, 0, 0, 49, 10, now).run();
    const checkinRequest = () => privateRouteRequest('/api/workout-checkins', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: '018e2aaa-6a86-4d9d-b36a-a3d96fd00d93', planId, recovery: { status: 'good', soreness: false, pain: false } }),
    });
    const request = checkinRequest();
    const response = await postCheckin(request);
    expect(response.status).toBe(200);
    const result = await response.json() as { checkin: { id: string; action: string; safetyContextVersion: string; safetyDecision: string; safetyReasonCodes: string[] } };
    expect(result.checkin).toMatchObject({ action: 'hold_for_review', safetyContextVersion: 'effective-safety-context-1', safetyDecision: 'blocked', safetyReasonCodes: ['pre_glucose_below_review_range'] });
    const stored = await database.prepare('select safety_context_version, safety_decision, safety_reason_codes from workout_checkins where id = ?').bind(result.checkin.id).first<{ safety_context_version: string; safety_decision: string; safety_reason_codes: string }>();
    expect(stored).toMatchObject({ safety_context_version: 'effective-safety-context-1', safety_decision: 'blocked' });
    expect(JSON.parse(stored!.safety_reason_codes)).toEqual(['pre_glucose_below_review_range']);

    const replay = await postCheckin(checkinRequest());
    expect(replay.status).toBe(200);
    await expect(replay.json()).resolves.toMatchObject({ checkin: { id: result.checkin.id }, replayed: true });
    await expect((await getCheckin()).json()).resolves.toMatchObject({ checkin: { id: result.checkin.id, safetyDecision: 'blocked' } });
  }), 60_000);
});
