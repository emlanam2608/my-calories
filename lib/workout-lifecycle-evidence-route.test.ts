import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  createMigratedRouteDb,
  privateRouteRequest,
  routeTestUsers,
  type TestUser,
} from './private-route-test-harness';

const mocks = vi.hoisted(() => ({
  db: undefined as unknown,
  user: null as TestUser | null,
}));
vi.mock('@/app/chatgpt-auth', () => ({
  getChatGPTUser: async () => mocks.user,
}));
vi.mock('@/db', () => ({ getDb: () => mocks.db }));

const [
  { POST: previewPlan },
  { GET: getPlan, POST: confirmPlan },
  { GET: getLogs, POST: postLog },
  { POST: postCheckin },
  { POST: confirmProposal, DELETE: dismissProposal },
] = await Promise.all([
  import('@/app/api/workout-plans/preview/route'),
  import('@/app/api/workout-plans/route'),
  import('@/app/api/workout-logs/route'),
  import('@/app/api/workout-checkins/route'),
  import('@/app/api/workout-plan-proposals/route'),
]);

const draft = {
  goal: 'fitness',
  heightCm: 170,
  ageYears: 34,
  sexForMetabolicCalculation: 'not_specified',
  pregnancyContext: 'not_applicable',
  activityLevel: 'light',
  trainingHistory: 'beginner',
  availableDays: ['mon', 'wed', 'fri'],
  equipment: [
    'bodyweight',
    'wall',
    'chair',
    'exercise_mat',
    'bicycle',
    'mini_treadmill',
    'resistance_band',
    'band_anchor',
    'dumbbells',
    'gym',
    'cable_machine',
  ],
  environments: ['home', 'outdoors', 'gym'],
  clinicianRestrictionFlags: [],
  medicationExerciseRiskFlags: [],
  symptomFlags: ['none'],
};

let routeDb: Awaited<ReturnType<typeof createMigratedRouteDb>>;
beforeAll(async () => {
  routeDb = await createMigratedRouteDb();
  mocks.db = routeDb.db;
  const now = Date.now();
  for (const owner of [routeTestUsers.ownerA, routeTestUsers.ownerB]) {
    await routeDb.database
      .prepare(
        'insert into profile_onboarding (id, owner_id, draft, status, created_at, updated_at) values (?, ?, ?, ?, ?, ?)',
      )
      .bind(
        `onboarding-${owner.userId}`,
        owner.userId,
        JSON.stringify(draft),
        'complete',
        now,
        now,
      )
      .run();
    await routeDb.database
      .prepare(
        'insert into workout_readiness (id, owner_id, chest_pain, fainting_or_dizziness, severe_shortness_of_breath, irregular_heartbeat, clinician_restriction, exercise_glucose_risk, status, confirmed_at, updated_at) values (?, ?, 0, 0, 0, 0, 0, 0, ?, ?, ?)',
      )
      .bind(`readiness-${owner.userId}`, owner.userId, 'cleared', now, now)
      .run();
  }
}, 60_000);
afterAll(async () => {
  mocks.db = undefined;
  await routeDb?.dispose();
});

function confirmation(previewId: string, idempotencyKey: string) {
  return confirmPlan(
    privateRouteRequest('/api/workout-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ previewId, idempotencyKey }),
    }),
  );
}

describe('persisted workout lifecycle and evidence routes', () => {
  it('enforces preview ownership, staleness, atomic activation, supersession, and exact replay', async () => {
    mocks.user = routeTestUsers.ownerA;
    const firstPreview = await previewPlan();
    expect(firstPreview.status).toBe(200);
    const firstBody = (await firstPreview.json()) as {
      previewId: string;
      plan: { draftStatus: string };
    };
    expect(firstBody.plan.draftStatus).toBe('complete');

    mocks.user = routeTestUsers.ownerB;
    expect(
      (
        await confirmation(
          firstBody.previewId,
          '018e2aaa-6a86-4d9d-b36a-a3d96fd00db1',
        )
      ).status,
    ).toBe(404);
    mocks.user = routeTestUsers.ownerA;
    await routeDb.database
      .prepare(
        'insert into request_deduplications (id, owner_id, idempotency_key, resource_type, resource_id, created_at) values (?, ?, ?, ?, ?, ?)',
      )
      .bind(
        'cross-resource-dedup',
        routeTestUsers.ownerA.userId,
        '018e2aaa-6a86-4d9d-b36a-a3d96fd00db8',
        'meal_entry',
        'meal-1',
        Date.now(),
      )
      .run();
    expect(
      (
        await confirmation(
          firstBody.previewId,
          '018e2aaa-6a86-4d9d-b36a-a3d96fd00db8',
        )
      ).status,
    ).toBe(409);
    const first = await confirmation(
      firstBody.previewId,
      '018e2aaa-6a86-4d9d-b36a-a3d96fd00db2',
    );
    expect(first.status).toBe(200);
    const firstSaved = (await first.json()) as {
      plan: { id: string; status: string; planningContext: unknown };
    };
    expect(firstSaved.plan).toMatchObject({ status: 'active' });
    expect(firstSaved.plan.planningContext).not.toBeNull();

    const secondBody = (await (await previewPlan()).json()) as {
      previewId: string;
    };
    const second = await confirmation(
      secondBody.previewId,
      '018e2aaa-6a86-4d9d-b36a-a3d96fd00db3',
    );
    expect(second.status).toBe(200);
    const secondSaved = (await second.json()) as { plan: { id: string } };
    expect(secondSaved.plan.id).not.toBe(firstSaved.plan.id);
    const replay = await confirmation(
      firstBody.previewId,
      '018e2aaa-6a86-4d9d-b36a-a3d96fd00db2',
    );
    await expect(replay.json()).resolves.toMatchObject({
      plan: { id: firstSaved.plan.id, status: 'superseded' },
      replayed: true,
    });

    const concurrentBody = (await (await previewPlan()).json()) as {
      previewId: string;
    };
    const outcomes = await Promise.all([
      confirmation(
        concurrentBody.previewId,
        '018e2aaa-6a86-4d9d-b36a-a3d96fd00db4',
      ),
      confirmation(
        concurrentBody.previewId,
        '018e2aaa-6a86-4d9d-b36a-a3d96fd00db5',
      ),
    ]);
    expect(
      outcomes
        .map((response) => response.status)
        .sort((left, right) => left - right),
    ).toEqual([200, 409]);
    const active = await routeDb.database
      .prepare(
        "select count(*) as count from workout_plans where owner_id = ? and status = 'active'",
      )
      .bind(routeTestUsers.ownerA.userId)
      .first<{ count: number }>();
    expect(active?.count).toBe(1);

    const expiredBody = (await (await previewPlan()).json()) as {
      previewId: string;
    };
    await routeDb.database
      .prepare('update workout_plan_previews set expires_at = 0 where id = ?')
      .bind(expiredBody.previewId)
      .run();
    const expired = await confirmation(
      expiredBody.previewId,
      '018e2aaa-6a86-4d9d-b36a-a3d96fd00db6',
    );
    expect(expired.status).toBe(409);
    await expect(expired.json()).resolves.toMatchObject({
      code: 'workout_plan_preview_stale',
    });

    const staleBody = (await (await previewPlan()).json()) as {
      previewId: string;
    };
    await routeDb.database
      .prepare(
        'update profile_onboarding set updated_at = updated_at + 1 where owner_id = ?',
      )
      .bind(routeTestUsers.ownerA.userId)
      .run();
    expect(
      (
        await confirmation(
          staleBody.previewId,
          '018e2aaa-6a86-4d9d-b36a-a3d96fd00db7',
        )
      ).status,
    ).toBe(409);
    const catalogStaleBody = (await (await previewPlan()).json()) as {
      previewId: string;
    };
    await routeDb.database
      .prepare("update exercise_catalog set catalog_version = 'starter-3'")
      .run();
    expect(
      (
        await confirmation(
          catalogStaleBody.previewId,
          '018e2aaa-6a86-4d9d-b36a-a3d96fd00db9',
        )
      ).status,
    ).toBe(409);
    await routeDb.database
      .prepare("update exercise_catalog set catalog_version = 'starter-2'")
      .run();
    const current = (await (await getPlan()).json()) as {
      plan: { id: string };
    };
    expect(current.plan.id).not.toBe(firstSaved.plan.id);
  }, 120_000);

  it('persists exact V2 exercise evidence, safety semantics, recovery, owner isolation, and exact replay', async () => {
    mocks.user = routeTestUsers.ownerA;
    const active = (await (await getPlan()).json()) as {
      plan: {
        id: string;
        plan: {
          sessions: Array<{
            id: string;
            sections: Array<{
              prescriptions: Array<{
                exerciseId: string;
                sets: number | null;
                reps: number | null;
                durationMinutes: number | null;
              }>;
            }>;
          }>;
        };
      };
    };
    const session = active.plan.plan.sessions[0];
    const prescriptions = [
      ...new Map(
        session.sections
          .flatMap((section) => section.prescriptions)
          .map((item) => [item.exerciseId, item]),
      ).values(),
    ];
    const exerciseResults = prescriptions.map((item, index) =>
      item.sets === null
        ? {
            exerciseId: item.exerciseId,
            status:
              index === prescriptions.length - 1 ? 'skipped' : 'completed',
            ...(index === prescriptions.length - 1
              ? {}
              : { actualDurationMinutes: item.durationMinutes! }),
          }
        : {
            exerciseId: item.exerciseId,
            status: 'completed',
            actualSets: item.sets,
            actualReps: item.reps!,
          },
    );
    const key = '018e2aaa-6a86-4d9d-b36a-a3d96fd00dc1';
    const payload = {
      idempotencyKey: key,
      planId: active.plan.id,
      sessionId: session.id,
      durationMinutes: 20,
      rpe: 4,
      pain: true,
      concerningSymptoms: false,
      preGlucose: 5.4,
      postGlucose: 6.1,
      exerciseResults,
    };
    const saved = await postLog(
      privateRouteRequest('/api/workout-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    );
    expect(saved.status).toBe(200);
    const savedBody = (await saved.json()) as { log: { id: string } };
    const logResponse = (await (await getLogs()).json()) as {
      logs: Array<{
        id: string;
        status: string;
        adherenceStatus: string;
        evidenceVersion: string;
        exerciseResults: unknown[];
        preGlucose: number;
      }>;
    };
    expect(logResponse.logs[0]).toMatchObject({
      id: savedBody.log.id,
      status: 'stopped_for_safety',
      adherenceStatus: 'not_counted_safety_stop',
      evidenceVersion: 'workout-exercise-evidence-1',
      preGlucose: 5.4,
    });
    expect(logResponse.logs[0].exerciseResults).toHaveLength(
      prescriptions.length,
    );

    const replay = await postLog(
      privateRouteRequest('/api/workout-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    );
    await expect(replay.json()).resolves.toMatchObject({
      log: { id: savedBody.log.id },
      replayed: true,
    });
    mocks.user = routeTestUsers.ownerB;
    const wrongOwner = await postLog(
      privateRouteRequest('/api/workout-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          idempotencyKey: '018e2aaa-6a86-4d9d-b36a-a3d96fd00dc2',
        }),
      }),
    );
    expect(wrongOwner.status).toBe(404);
    mocks.user = routeTestUsers.ownerA;
    const checkin = await postCheckin(
      privateRouteRequest('/api/workout-checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: '018e2aaa-6a86-4d9d-b36a-a3d96fd00dc3',
          planId: active.plan.id,
          recovery: { status: 'poor', soreness: true, pain: false },
        }),
      }),
    );
    expect(checkin.status).toBe(200);
    await expect(checkin.json()).resolves.toMatchObject({
      checkin: {
        action: 'hold_for_review',
        recovery: { status: 'poor', soreness: true, pain: false },
        dataCompleteness: 'structured_recovery',
      },
    });
  }, 120_000);

  it('keeps proposals inert until explicit confirmation and handles stale, concurrent, replayed, and dismissed mutations', async () => {
    mocks.user = routeTestUsers.ownerB;
    const preview = (await (await previewPlan()).json()) as {
      previewId: string;
    };
    const initial = await confirmation(
      preview.previewId,
      '018e2aaa-6a86-4d9d-b36a-a3d96fd00dd1',
    );
    const initialBody = (await initial.json()) as { plan: { id: string } };
    const createProposal = async (key: string) => {
      const response = await postCheckin(
        privateRouteRequest('/api/workout-checkins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idempotencyKey: key,
            planId: (
              (await (await getPlan()).json()) as { plan: { id: string } }
            ).plan.id,
            recovery: { status: 'good' },
          }),
        }),
      );
      expect(response.status).toBe(200);
      return response.json() as Promise<{
        proposal: { id: string; action: string; status: string };
      }>;
    };
    const concurrentCheckinKey = '018e2aaa-6a86-4d9d-b36a-a3d96fd00dc4';
    const concurrentPlanId = (
      (await (await getPlan()).json()) as { plan: { id: string } }
    ).plan.id;
    const concurrentCheckin = () =>
      postCheckin(
        privateRouteRequest('/api/workout-checkins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idempotencyKey: concurrentCheckinKey,
            planId: concurrentPlanId,
            recovery: { status: 'good' },
          }),
        }),
      );
    const concurrentCheckins = await Promise.all([
      concurrentCheckin(),
      concurrentCheckin(),
    ]);
    expect(concurrentCheckins.map((response) => response.status)).toEqual([
      200, 200,
    ]);
    const concurrentCheckinBodies = (await Promise.all(
      concurrentCheckins.map((response) => response.json()),
    )) as Array<{
      checkin: { id: string };
      proposal: { id: string };
      replayed: boolean;
    }>;
    expect(
      new Set(concurrentCheckinBodies.map((body) => body.checkin.id)).size,
    ).toBe(1);
    expect(
      new Set(concurrentCheckinBodies.map((body) => body.proposal.id)).size,
    ).toBe(1);
    expect(
      concurrentCheckinBodies
        .map((body) => body.replayed)
        .sort((left, right) => Number(left) - Number(right)),
    ).toEqual([false, true]);
    const first = await createProposal('018e2aaa-6a86-4d9d-b36a-a3d96fd00dd2');
    expect(first.proposal).toMatchObject({
      action: 'maintain',
      status: 'pending',
    });
    const firstReplay = await createProposal(
      '018e2aaa-6a86-4d9d-b36a-a3d96fd00dd2',
    );
    expect(firstReplay.proposal.id).toBe(first.proposal.id);
    expect(
      ((await (await getPlan()).json()) as { plan: { id: string } }).plan.id,
    ).toBe(initialBody.plan.id);
    const proposalRequest = (proposalId: string, idempotencyKey: string) =>
      privateRouteRequest('/api/workout-plan-proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, idempotencyKey }),
      });
    mocks.user = routeTestUsers.ownerA;
    expect(
      (
        await confirmProposal(
          proposalRequest(
            first.proposal.id,
            '018e2aaa-6a86-4d9d-b36a-a3d96fd00dd3',
          ),
        )
      ).status,
    ).toBe(404);
    mocks.user = routeTestUsers.ownerB;
    const confirmed = await confirmProposal(
      proposalRequest(
        first.proposal.id,
        '018e2aaa-6a86-4d9d-b36a-a3d96fd00dd4',
      ),
    );
    expect(confirmed.status).toBe(200);
    const confirmedBody = (await confirmed.json()) as { plan: { id: string } };
    expect(confirmedBody.plan.id).not.toBe(initialBody.plan.id);
    const replay = await confirmProposal(
      proposalRequest(
        first.proposal.id,
        '018e2aaa-6a86-4d9d-b36a-a3d96fd00dd4',
      ),
    );
    await expect(replay.json()).resolves.toMatchObject({
      plan: { id: confirmedBody.plan.id },
      replayed: true,
    });

    const concurrent = await createProposal(
      '018e2aaa-6a86-4d9d-b36a-a3d96fd00dd5',
    );
    const outcomes = await Promise.all([
      confirmProposal(
        proposalRequest(
          concurrent.proposal.id,
          '018e2aaa-6a86-4d9d-b36a-a3d96fd00dd6',
        ),
      ),
      confirmProposal(
        proposalRequest(
          concurrent.proposal.id,
          '018e2aaa-6a86-4d9d-b36a-a3d96fd00dd7',
        ),
      ),
    ]);
    expect(
      outcomes
        .map((response) => response.status)
        .sort((left, right) => left - right),
    ).toEqual([200, 409]);
    const active = await routeDb.database
      .prepare(
        "select count(*) as count from workout_plans where owner_id = ? and status = 'active'",
      )
      .bind(routeTestUsers.ownerB.userId)
      .first<{ count: number }>();
    expect(active?.count).toBe(1);
    const oldReplay = await confirmProposal(
      proposalRequest(
        first.proposal.id,
        '018e2aaa-6a86-4d9d-b36a-a3d96fd00dd4',
      ),
    );
    await expect(oldReplay.json()).resolves.toMatchObject({
      plan: { id: confirmedBody.plan.id, status: 'superseded' },
      replayed: true,
    });

    const dismissed = await createProposal(
      '018e2aaa-6a86-4d9d-b36a-a3d96fd00dd8',
    );
    const activeBeforeDismissal = (
      (await (await getPlan()).json()) as { plan: { id: string } }
    ).plan.id;
    const dismissal = await dismissProposal(
      privateRouteRequest('/api/workout-plan-proposals', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: dismissed.proposal.id,
          idempotencyKey: '018e2aaa-6a86-4d9d-b36a-a3d96fd00dd9',
        }),
      }),
    );
    await expect(dismissal.json()).resolves.toMatchObject({
      proposal: { status: 'dismissed' },
    });
    expect(
      ((await (await getPlan()).json()) as { plan: { id: string } }).plan.id,
    ).toBe(activeBeforeDismissal);

    const expired = await createProposal(
      '018e2aaa-6a86-4d9d-b36a-a3d96fd00df3',
    );
    await routeDb.database
      .prepare(
        'update workout_adaptation_proposals set expires_at = 0 where id = ?',
      )
      .bind(expired.proposal.id)
      .run();
    expect(
      (
        await confirmProposal(
          proposalRequest(
            expired.proposal.id,
            '018e2aaa-6a86-4d9d-b36a-a3d96fd00df4',
          ),
        )
      ).status,
    ).toBe(409);

    const catalogStale = await createProposal(
      '018e2aaa-6a86-4d9d-b36a-a3d96fd00dec',
    );
    await routeDb.database
      .prepare("update exercise_catalog set catalog_version = 'starter-3'")
      .run();
    expect(
      (
        await confirmProposal(
          proposalRequest(
            catalogStale.proposal.id,
            '018e2aaa-6a86-4d9d-b36a-a3d96fd00ded',
          ),
        )
      ).status,
    ).toBe(409);
    await routeDb.database
      .prepare("update exercise_catalog set catalog_version = 'starter-2'")
      .run();

    const safetyStale = await createProposal(
      '018e2aaa-6a86-4d9d-b36a-a3d96fd00dee',
    );
    await routeDb.database
      .prepare(
        'update workout_readiness set chest_pain = 1, status = ?, updated_at = updated_at + 1 where owner_id = ?',
      )
      .bind('needs_review', routeTestUsers.ownerB.userId)
      .run();
    expect(
      (
        await confirmProposal(
          proposalRequest(
            safetyStale.proposal.id,
            '018e2aaa-6a86-4d9d-b36a-a3d96fd00def',
          ),
        )
      ).status,
    ).toBe(409);
    await routeDb.database
      .prepare(
        'update workout_readiness set chest_pain = 0, status = ?, updated_at = updated_at + 1 where owner_id = ?',
      )
      .bind('cleared', routeTestUsers.ownerB.userId)
      .run();

    const baseStale = await createProposal(
      '018e2aaa-6a86-4d9d-b36a-a3d96fd00df0',
    );
    const replacementPreview = (await (await previewPlan()).json()) as {
      previewId: string;
    };
    expect(
      (
        await confirmation(
          replacementPreview.previewId,
          '018e2aaa-6a86-4d9d-b36a-a3d96fd00df1',
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await confirmProposal(
          proposalRequest(
            baseStale.proposal.id,
            '018e2aaa-6a86-4d9d-b36a-a3d96fd00df2',
          ),
        )
      ).status,
    ).toBe(409);

    const stale = await createProposal('018e2aaa-6a86-4d9d-b36a-a3d96fd00dea');
    await routeDb.database
      .prepare(
        'update profile_onboarding set updated_at = updated_at + 1 where owner_id = ?',
      )
      .bind(routeTestUsers.ownerB.userId)
      .run();
    const staleResponse = await confirmProposal(
      proposalRequest(
        stale.proposal.id,
        '018e2aaa-6a86-4d9d-b36a-a3d96fd00deb',
      ),
    );
    expect(staleResponse.status).toBe(409);
    await expect(staleResponse.json()).resolves.toMatchObject({
      code: 'workout_adaptation_proposal_stale',
    });
  }, 120_000);
});
