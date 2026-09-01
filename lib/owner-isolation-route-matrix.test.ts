import { createMigratedRouteDb, privateRouteRequest, routeTestUsers } from './private-route-test-harness';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('@/app/chatgpt-auth', () => ({ getChatGPTUser: async () => routeTestUsers.ownerA }));
vi.mock('@/db', () => ({ getDb: () => mocks.db }));
vi.mock('cloudflare:workers', () => ({ env: { FILES: { delete: async () => undefined } } }));

const [{ GET: getMeasurements, POST: postMeasurement }, { GET: getPlans }, { GET: getLogs }, { GET: getReminders }, { GET: getAnalytics }, { GET: getCsv }] = await Promise.all([
  import('@/app/api/measurements/route'),
  import('@/app/api/workout-plans/route'),
  import('@/app/api/workout-logs/route'),
  import('@/app/api/reminders/route'),
  import('@/app/api/analytics/route'),
  import('@/app/api/exports/csv/route'),
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
    await database.prepare('insert into reminders (id, owner_id, kind, schedule, next_delivery_at, status) values (?, ?, ?, ?, ?, ?)').bind('018e2aaa-6a86-4d9d-b36a-a3d96fd0d0c4', routeTestUsers.ownerB.userId, 'workout', JSON.stringify({ timezone: 'Asia/Bangkok', time: '08:00', days: ['mon'] }), now, 'active').run();

    await expect((await getMeasurements(privateRouteRequest('/api/measurements?days=365'))).json()).resolves.toEqual({ measurements: [] });
    await expect((await getPlans()).json()).resolves.toEqual({ plan: null });
    await expect((await getLogs()).json()).resolves.toEqual({ logs: [] });
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
});
