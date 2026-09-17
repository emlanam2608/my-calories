import { privateRouteRequest } from './private-route-test-harness';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: null as { userId: string; displayName: string; email: string; fullName: string | null } | null,
}));

vi.mock('@/app/chatgpt-auth', () => ({ getChatGPTUser: async () => mocks.user }));
vi.mock('@/db', () => ({ getDb: () => { throw new Error('database must not be accessed before authentication'); } }));
vi.mock('cloudflare:workers', () => ({ env: { FILES: {} } }));
vi.mock('@/lib/upload-expiry-cleanup', () => ({ cleanExpiredPrivateUploads: async () => undefined }));

const [{ GET: getMeasurements }, { GET: getWorkoutPlans }, { POST: previewWorkoutPlan }, { GET: getWorkoutProposals }, { GET: getWorkoutLogs }, { GET: getWorkoutCheckins }, { GET: getReminders }, { GET: getAnalytics }, { GET: getCsv }, { GET: getArchive }, { GET: getSafetyContext }, { DELETE: deleteAccount }] = await Promise.all([
  import('@/app/api/measurements/route'),
  import('@/app/api/workout-plans/route'),
  import('@/app/api/workout-plans/preview/route'),
  import('@/app/api/workout-plan-proposals/route'),
  import('@/app/api/workout-logs/route'),
  import('@/app/api/workout-checkins/route'),
  import('@/app/api/reminders/route'),
  import('@/app/api/analytics/route'),
  import('@/app/api/exports/csv/route'),
  import('@/app/api/exports/archive/route'),
  import('@/app/api/safety-context/route'),
  import('@/app/api/account/route'),
]);

describe('private route authentication matrix', () => {
  beforeEach(() => { mocks.user = null; });

  it.each([
    ['measurements', () => getMeasurements(privateRouteRequest('/api/measurements', {}, null))],
    ['workout plans', () => getWorkoutPlans()],
    ['workout plan previews', () => previewWorkoutPlan()],
    ['workout plan proposals', () => getWorkoutProposals()],
    ['workout logs', () => getWorkoutLogs()],
    ['workout check-ins', () => getWorkoutCheckins()],
    ['reminders', () => getReminders()],
    ['analytics', () => getAnalytics(privateRouteRequest('/api/analytics?days=30', {}, null))],
    ['CSV export', () => getCsv(privateRouteRequest('/api/exports/csv?start=2026-09-01&end=2026-09-01', {}, null))],
    ['full archive', () => getArchive()],
    ['effective safety context', () => getSafetyContext()],
    ['account deletion', () => deleteAccount(privateRouteRequest('/api/account', { method: 'DELETE' }, null))],
  ])('rejects anonymous %s requests before database access', async (_name, call) => {
    expect((await call()).status).toBe(401);
  });

  it('requires the exact account-deletion phrase before database access', async () => {
    mocks.user = { userId: 'owner-a', displayName: 'Owner A', email: 'owner-a@example.test', fullName: 'Owner A' };
    const response = await deleteAccount(privateRouteRequest('/api/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: '018e2aaa-6a86-4d9d-b36a-a3d96fd0d0c2', confirmation: 'delete' }),
    }));
    expect(response.status).toBe(400);
  });
});
