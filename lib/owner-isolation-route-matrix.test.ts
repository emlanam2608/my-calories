import { createMigratedRouteDb, privateRouteRequest, routeTestUsers } from './private-route-test-harness';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('@/app/chatgpt-auth', () => ({ getChatGPTUser: async () => routeTestUsers.ownerA }));
vi.mock('@/db', () => ({ getDb: () => mocks.db }));
vi.mock('cloudflare:workers', () => ({ env: { FILES: { delete: async () => undefined } } }));

const [{ GET: getMeasurements, POST: postMeasurement }, { GET: getPlans }, { GET: getLogs }, { GET: getCheckins }, { GET: getReminders }, { GET: getAnalytics }, { GET: getCsv }, { GET: getSafetyContext }] = await Promise.all([
  import('@/app/api/measurements/route'),
  import('@/app/api/workout-plans/route'),
  import('@/app/api/workout-logs/route'),
  import('@/app/api/workout-checkins/route'),
  import('@/app/api/reminders/route'),
  import('@/app/api/analytics/route'),
  import('@/app/api/exports/csv/route'),
  import('@/app/api/safety-context/route'),
]);

const now = new Date('2026-09-01T00:00:00.000Z').getTime();
const mealSnapshot = JSON.stringify({ totals: { calories: 500, protein: 25, fiber: 4, sodium: 600 }, servingDescription: '1 bowl', source: 'manual_entry', sourceVersion: 'test', sourceReference: null, estimationLevel: 'user_confirmed', ingredients: ['rice'] });

async function withDatabase(run: (database: Awaited<ReturnType<typeof createMigratedRouteDb>>) => Promise<void>) {
  const routeDb = await createMigratedRouteDb();
  mocks.db = routeDb.db;
  try {
    await run(routeDb);
  } finally {
    mocks.db = undefined;
    await routeDb.dispose();
  }
}

describe('owner-isolation route matrix on migrated D1', () => {
  beforeEach(() => { mocks.db = undefined; });

  it('does not return another owner measurements, plans, logs, or reminders', async () => withDatabase(async ({ database }) => {
    await database.prepare('insert into measurements (id, owner_id, metric, value_scaled, value_scale, unit, source, confirmation_status, provenance, occurred_at, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('018e2aaa-6a86-4d9d-b36a-a3d96fd0d0c1', routeTestUsers.ownerB.userId, 'weight', 7000, 100, 'kg', 'manual', 'confirmed', 'user_entered', now, now).run();
    await database.prepare('insert into workout_plans (id, owner_id, plan_version, period_start, status, plan, created_at, confirmed_at) values (?, ?, ?, ?, ?, ?, ?, ?)').bind('018e2aaa-6a86-4d9d-b36a-a3d96fd0d0c2', routeTestUsers.ownerB.userId, 'starter-plan-1', '2026-09-01', 'confirmed', '{}', now, now).run();
    await database.prepare('insert into workout_sessions (id, owner_id, plan_version, status) values (?, ?, ?, ?)').bind('018e2aaa-6a86-4d9d-b36a-a3d96fd0d0c3', routeTestUsers.ownerB.userId, 'starter-plan-1', 'completed').run();
    await database.prepare('insert into workout_checkins (id, owner_id, plan_id, action, planned_sessions, completed_sessions, safety_flag, created_at) values (?, ?, ?, ?, ?, ?, ?, ?)').bind('018e2aaa-6a86-4d9d-b36a-a3d96fd0d0c8', routeTestUsers.ownerB.userId, '018e2aaa-6a86-4d9d-b36a-a3d96fd0d0c2', 'maintain', 3, 3, 0, now).run();
    await database.prepare('insert into reminders (id, owner_id, kind, schedule, next_delivery_at, status) values (?, ?, ?, ?, ?, ?)').bind('018e2aaa-6a86-4d9d-b36a-a3d96fd0d0c4', routeTestUsers.ownerB.userId, 'workout', JSON.stringify({ timezone: 'Asia/Bangkok', time: '08:00', days: ['mon'] }), now, 'active').run();

    await expect((await getMeasurements(privateRouteRequest('/api/measurements?days=365'))).json()).resolves.toEqual({ measurements: [] });
    await expect((await getPlans()).json()).resolves.toEqual({ plan: null });
    await expect((await getLogs()).json()).resolves.toEqual({ logs: [] });
    await expect((await getCheckins()).json()).resolves.toEqual({ checkin: null });
    await expect((await getReminders()).json()).resolves.toEqual({ reminders: [] });
  }), 60_000);

  it('excludes another owner analytics and exported records', async () => withDatabase(async ({ database }) => {
    await database.prepare('insert into meal_entries (id, owner_id, occurred_at, meal_type, name, nutrition_snapshot, analysis_source, confidence, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('018e2aaa-6a86-4d9d-b36a-a3d96fd0d0c5', routeTestUsers.ownerB.userId, now, 'lunch', 'Owner B meal', mealSnapshot, 'manual_entry', 100, now).run();

    const analytics = await getAnalytics(privateRouteRequest('/api/analytics?days=30'));
    expect(analytics.status).toBe(200);
    expect(JSON.stringify(await analytics.json())).not.toContain('Owner B');

    const csv = await getCsv(privateRouteRequest('/api/exports/csv?start=2026-09-01&end=2026-09-01'));
    expect(csv.status).toBe(200);
    expect(await csv.text()).not.toContain('Owner B meal');
  }), 60_000);

  it('rejects a report measurement that references another owner private upload', async () => withDatabase(async ({ database }) => {
    const uploadId = '018e2aaa-6a86-4d9d-b36a-a3d96fd0d0c6';
    await database.prepare('insert into uploads (id, owner_id, storage_key, kind, content_type, byte_size, width, height, status, expires_at, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(uploadId, routeTestUsers.ownerB.userId, 'uploads/owner-b.png', 'measurement_report', 'image/png', 10, 32, 32, 'pending', now + 86_400_000, now).run();
    const response = await postMeasurement(privateRouteRequest('/api/measurements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: '018e2aaa-6a86-4d9d-b36a-a3d96fd0d0c7', metric: 'weight', value: 70, unit: 'kg', occurredAt: '2026-09-01T00:00:00.000Z', source: 'report_photo', sourceUploadId: uploadId, retainSourceImage: false }),
    }));
    expect(response.status).toBe(400);
  }), 60_000);

  it('resolves safety facts only from the authenticated owner records', async () => withDatabase(async ({ database }) => {
    const onboardingDraft = JSON.stringify({ ageYears: 15, pregnancyContext: 'pregnant', medicationExerciseRiskFlags: ['glucose_lowering_without_plan'] });
    await database.prepare('insert into profile_onboarding (id, owner_id, draft, status, created_at, updated_at) values (?, ?, ?, ?, ?, ?)').bind('onboarding-owner-b', routeTestUsers.ownerB.userId, onboardingDraft, 'complete', now, now).run();
    await database.prepare('insert into profile_onboarding (id, owner_id, draft, status, created_at, updated_at) values (?, ?, ?, ?, ?, ?)').bind('onboarding-owner-a', routeTestUsers.ownerA.userId, JSON.stringify({ ageYears: 34, pregnancyContext: 'not_applicable' }), 'complete', now, now).run();
    await database.prepare('insert into workout_readiness (id, owner_id, chest_pain, fainting_or_dizziness, severe_shortness_of_breath, irregular_heartbeat, clinician_restriction, exercise_glucose_risk, status, confirmed_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('readiness-owner-b', routeTestUsers.ownerB.userId, 1, 0, 0, 0, 0, 0, 'needs_review', now, now).run();
    await database.prepare('insert into workout_readiness (id, owner_id, chest_pain, fainting_or_dizziness, severe_shortness_of_breath, irregular_heartbeat, clinician_restriction, exercise_glucose_risk, status, confirmed_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('readiness-owner-a', routeTestUsers.ownerA.userId, 0, 0, 0, 0, 0, 0, 'cleared', now, now).run();
    await database.prepare('insert into workout_sessions (id, owner_id, plan_version, status, pain, concerning_symptoms, completed_at) values (?, ?, ?, ?, ?, ?, ?)').bind('log-owner-b', routeTestUsers.ownerB.userId, 'starter-plan-1', 'stopped_for_safety', 1, 1, now).run();
    await database.prepare('insert into workout_sessions (id, owner_id, plan_version, status, pain, concerning_symptoms, completed_at) values (?, ?, ?, ?, ?, ?, ?)').bind('log-owner-a', routeTestUsers.ownerA.userId, 'starter-plan-1', 'completed', 0, 0, now).run();

    const response = await getSafetyContext();
    expect(response.status).toBe(200);
    const body = await response.json() as { context: { facts: { eligibility: { state: string }; readiness: { state: string }; recentWorkoutSafety: { sourceRecordIds: string[] } }; sources: Array<{ recordId: string }> } };
    expect(body.context.facts.eligibility.state).toBe('adult');
    expect(body.context.facts.readiness.state).toBe('cleared');
    expect(body.context.facts.recentWorkoutSafety.sourceRecordIds).toEqual([]);
    expect(body.context.sources.map((source) => source.recordId)).toEqual(['onboarding-owner-a', 'readiness-owner-a', 'log-owner-a']);
    expect(JSON.stringify(body)).not.toContain('owner-b');
  }), 60_000);
});
