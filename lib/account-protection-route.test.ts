import { archiveUploadLimitBytes } from './account-archive';
import { evaluateMealHealthFindings } from './health-rule-engine';
import { createMigratedRouteDb, privateRouteRequest, routeTestUsers } from './private-route-test-harness';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: undefined as unknown,
  user: null as { userId: string; displayName: string; email: string; fullName: string | null } | null,
  files: {
    get: async (_key: string) => null as null,
    delete: async (_key: string) => undefined as void,
  },
}));

vi.mock('@/app/chatgpt-auth', () => ({ getChatGPTUser: async () => mocks.user }));
vi.mock('@/db', () => ({ getDb: () => mocks.db }));
vi.mock('cloudflare:workers', () => ({ env: { FILES: mocks.files } }));

const [{ GET: getArchive }, { DELETE: deleteAccount }] = await Promise.all([
  import('@/app/api/exports/archive/route'),
  import('@/app/api/account/route'),
]);

const now = new Date('2026-09-01T00:00:00.000Z').getTime();
const uploadId = '018e2aaa-6a86-4d9d-b36a-a3d96fd0d0c1';

async function withDatabase(run: (database: Awaited<ReturnType<typeof createMigratedRouteDb>>) => Promise<void>) {
  const routeDb = await createMigratedRouteDb();
  mocks.db = routeDb.db;
  mocks.user = routeTestUsers.ownerA;
  try {
    await run(routeDb);
  } finally {
    mocks.db = undefined;
    mocks.user = null;
    await routeDb.dispose();
  }
}

async function insertUpload(database: Awaited<ReturnType<typeof createMigratedRouteDb>>['database'], status: string, byteSize = 10) {
  await database.prepare('insert into uploads (id, owner_id, storage_key, kind, content_type, byte_size, width, height, status, expires_at, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(uploadId, routeTestUsers.ownerA.userId, 'uploads/private.png', 'measurement_report', 'image/png', byteSize, 32, 32, status, now + 86_400_000, now).run();
}

describe('archive and account deletion safety', () => {
  beforeEach(() => {
    mocks.user = null;
    mocks.db = undefined;
    mocks.files.get = async () => null;
    mocks.files.delete = async () => undefined;
  });

  it('returns 413 before reading private objects when the archive preflight is too large', async () => withDatabase(async ({ database }) => {
    await insertUpload(database, 'retained', archiveUploadLimitBytes + 1);
    let reads = 0;
    mocks.files.get = async () => { reads += 1; return null; };
    const response = await getArchive();
    expect(response.status).toBe(413);
    expect(reads).toBe(0);
  }), 60_000);

  it('marks deleted, expired, and missing upload content unavailable without exposing storage keys', async () => withDatabase(async ({ database }) => {
    await insertUpload(database, 'deleted');
    await database.prepare('insert into uploads (id, owner_id, storage_key, kind, content_type, byte_size, width, height, status, expires_at, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('018e2aaa-6a86-4d9d-b36a-a3d96fd0d0c2', routeTestUsers.ownerA.userId, 'uploads/expired.png', 'measurement_report', 'image/png', 10, 32, 32, 'expired', now, now).run();
    await database.prepare('insert into uploads (id, owner_id, storage_key, kind, content_type, byte_size, width, height, status, expires_at, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('018e2aaa-6a86-4d9d-b36a-a3d96fd0d0c7', routeTestUsers.ownerA.userId, 'uploads/missing.png', 'measurement_report', 'image/png', 10, 32, 32, 'retained', now, now).run();
    let reads = 0;
    mocks.files.get = async () => { reads += 1; return null; };
    const archive = await (await getArchive()).json() as { records: { uploads: Array<{ content: { state: string; reason: string } }> } };
    expect(reads).toBe(1);
    expect(archive.records.uploads.map((upload) => upload.content)).toEqual([
      { state: 'unavailable', reason: 'deleted' },
      { state: 'unavailable', reason: 'expired' },
      { state: 'unavailable', reason: 'missing' },
    ]);
    expect(JSON.stringify(archive)).not.toContain('uploads/private.png');
    expect(JSON.stringify(archive)).not.toContain('requestDeduplications');
  }), 60_000);

  it('preserves encrypted sensitive notes with an explicit marker when decryption is unavailable', async () => withDatabase(async ({ database }) => {
    const priorKey = process.env.HEALTH_DATA_ENCRYPTION_KEY;
    delete process.env.HEALTH_DATA_ENCRYPTION_KEY;
    try {
      await database.prepare('insert into profile_sensitive_notes (id, owner_id, ciphertext, key_version, created_at, updated_at) values (?, ?, ?, ?, ?, ?)').bind(
        '018e2aaa-6a86-4d9d-b36a-a3d96fd0d0c9',
        routeTestUsers.ownerA.userId,
        JSON.stringify({ algorithm: 'AES-GCM', iv: 'AA==', ciphertext: 'AA==' }),
        'v1', now, now,
      ).run();
      const archive = await (await getArchive()).json() as { sensitiveNotes: { format: string; value: unknown[] } };
      expect(archive.sensitiveNotes.format).toBe('encrypted-health-notes-v1');
      expect(archive.sensitiveNotes.value).toHaveLength(1);
    } finally {
      if (priorKey === undefined) delete process.env.HEALTH_DATA_ENCRYPTION_KEY;
      else process.env.HEALTH_DATA_ENCRYPTION_KEY = priorKey;
    }
  }), 60_000);

  it('includes the immutable workout check-in safety decision in the owner archive', async () => withDatabase(async ({ database }) => {
    await database.prepare(`
      insert into workout_checkins (
        id, owner_id, plan_id, action, planned_sessions, completed_sessions,
        safety_flag, safety_context_version, safety_decision, safety_reason_codes, created_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      '018e2aaa-6a86-4d9d-b36a-a3d96fd0d0d0',
      routeTestUsers.ownerA.userId,
      '018e2aaa-6a86-4d9d-b36a-a3d96fd0d0d1',
      'hold_for_review',
      3,
      1,
      1,
      'effective-safety-context-1',
      'blocked',
      JSON.stringify(['pre_glucose_below_review_range']),
      now,
    ).run();

    const archive = await (await getArchive()).json() as {
      records: { workoutCheckins: Array<Record<string, unknown>> };
    };
    expect(archive.records.workoutCheckins).toEqual([
      expect.objectContaining({
        safetyContextVersion: 'effective-safety-context-1',
        safetyDecision: 'blocked',
        safetyReasonCodes: ['pre_glucose_below_review_range'],
      }),
    ]);
  }), 60_000);

  it('includes immutable meal findings in the owner archive', async () => withDatabase(async ({ database }) => {
    const snapshot = {
      totals: { calories: 800, protein: 20, fiber: 4, sodium: 900 },
      servingDescription: '1 serving', source: 'manual_entry', sourceVersion: 'test-v1',
      sourceReference: null, estimationLevel: 'user_confirmed' as const, ingredients: ['rice'],
    };
    const findings = evaluateMealHealthFindings(snapshot.totals, [], snapshot.ingredients, undefined, [
      { metric: 'calories', value: 1700, unit: 'kcal', authority: 'clinician_defined' },
      { metric: 'protein', value: 90, unit: 'g', authority: 'guideline_default' },
      { metric: 'fiber', value: 28, unit: 'g', authority: 'guideline_default' },
      { metric: 'sodium', value: 1500, unit: 'mg', authority: 'clinician_defined' },
    ], snapshot.estimationLevel);
    await database.prepare('insert into meal_entries (id, owner_id, occurred_at, meal_type, name, nutrition_snapshot, health_findings, analysis_source, confidence, review_id, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(
      '018e2aaa-6a86-4d9d-b36a-a3d96fd0d0e0', routeTestUsers.ownerA.userId, now, 'lunch', 'Archived meal',
      JSON.stringify(snapshot), JSON.stringify(findings), 'manual_entry', 100, '018e2aaa-6a86-4d9d-b36a-a3d96fd0d099', now,
    ).run();

    const archive = await (await getArchive()).json() as { records: { meals: Array<{ healthFindings: unknown[]; reviewId?: string }> } };
    expect(archive.records.meals[0].healthFindings).toEqual(findings);
    expect(archive.records.meals[0]).not.toHaveProperty('reviewId');
  }), 60_000);

  it('does not report deletion when private-object deletion fails', async () => withDatabase(async ({ database }) => {
    await insertUpload(database, 'retained');
    mocks.files.delete = async () => { throw new Error('R2 unavailable'); };
    const response = await deleteAccount(privateRouteRequest('/api/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: '018e2aaa-6a86-4d9d-b36a-a3d96fd0d0c3', confirmation: 'DELETE MY DATA' }),
    }));
    expect(response.status).toBe(503);
    expect((await database.prepare('select count(*) as count from uploads where owner_id = ?').bind(routeTestUsers.ownerA.userId).first<{ count: number }>())?.count).toBe(1);
  }), 60_000);

  it('does not report deletion when the database batch fails, so it can be retried', async () => {
    mocks.user = routeTestUsers.ownerA;
    const deletion = { where: () => ({}) };
    mocks.db = {
      select: () => ({ from: () => ({ where: async () => [] }) }),
      delete: () => deletion,
      batch: async () => { throw new Error('D1 unavailable'); },
    };
    const response = await deleteAccount(privateRouteRequest('/api/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: '018e2aaa-6a86-4d9d-b36a-a3d96fd0d0c8', confirmation: 'DELETE MY DATA' }),
    }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('retry') });
  });

  it('permanently deletes only the confirmed owner D1 records after private-object deletion succeeds', async () => withDatabase(async ({ database }) => {
    await database.prepare('insert into profiles (id, owner_id, locale, timezone, created_at, updated_at) values (?, ?, ?, ?, ?, ?)').bind('018e2aaa-6a86-4d9d-b36a-a3d96fd0d0c4', routeTestUsers.ownerA.userId, 'vi', 'Asia/Bangkok', now, now).run();
    await database.prepare('insert into profiles (id, owner_id, locale, timezone, created_at, updated_at) values (?, ?, ?, ?, ?, ?)').bind('018e2aaa-6a86-4d9d-b36a-a3d96fd0d0c5', routeTestUsers.ownerB.userId, 'vi', 'Asia/Bangkok', now, now).run();
    await database.prepare('insert into meal_analysis_reviews (id, owner_id, analysis, context_fingerprint, expires_at, created_at) values (?, ?, ?, ?, ?, ?)')
      .bind('018e2aaa-6a86-4d9d-b36a-a3d96fd0d0c7', routeTestUsers.ownerA.userId, '{}', 'owner-a-context', now + 60_000, now).run();
    await database.prepare('insert into meal_analysis_reviews (id, owner_id, analysis, context_fingerprint, expires_at, created_at) values (?, ?, ?, ?, ?, ?)')
      .bind('018e2aaa-6a86-4d9d-b36a-a3d96fd0d0c9', routeTestUsers.ownerB.userId, '{}', 'owner-b-context', now + 60_000, now).run();
    const response = await deleteAccount(privateRouteRequest('/api/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: '018e2aaa-6a86-4d9d-b36a-a3d96fd0d0c6', confirmation: 'DELETE MY DATA' }),
    }));
    expect(response.status).toBe(204);
    expect((await database.prepare('select count(*) as count from profiles where owner_id = ?').bind(routeTestUsers.ownerA.userId).first<{ count: number }>())?.count).toBe(0);
    expect((await database.prepare('select count(*) as count from profiles where owner_id = ?').bind(routeTestUsers.ownerB.userId).first<{ count: number }>())?.count).toBe(1);
    expect((await database.prepare('select count(*) as count from meal_analysis_reviews where owner_id = ?').bind(routeTestUsers.ownerA.userId).first<{ count: number }>())?.count).toBe(0);
    expect((await database.prepare('select count(*) as count from meal_analysis_reviews where owner_id = ?').bind(routeTestUsers.ownerB.userId).first<{ count: number }>())?.count).toBe(1);
  }), 60_000);
});
