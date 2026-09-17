import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exerciseCatalog } from '@/db/schema';
import { exerciseCatalogResponseSchema } from './exercise-catalog';
import { catalogSetupCoverage } from './exercise-eligibility';
import { workoutEquipmentSchema, workoutEnvironmentSchema } from './contracts';
import {
  createFakeRouteDb,
  createMigratedRouteDb,
  routeTestUsers,
} from './private-route-test-harness';

const mocks = vi.hoisted(() => ({
  db: undefined as unknown,
  user: null as {
    userId: string;
    displayName: string;
    email: string;
    fullName: string | null;
  } | null,
}));

vi.mock('@/app/chatgpt-auth', () => ({
  getChatGPTUser: async () => mocks.user,
}));
vi.mock('@/db', () => ({ getDb: () => mocks.db }));

const { GET } = await import('@/app/api/exercises/route');

describe('exercise catalog route', () => {
  beforeEach(() => {
    mocks.user = routeTestUsers.ownerA;
    mocks.db = undefined;
  });

  it('rejects anonymous access before reading the catalog', async () => {
    mocks.user = null;
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mocks.db).toBeUndefined();
  });

  it('returns version and explicit unreviewed status from a clean migrated catalog', async () => {
    const routeDb = await createMigratedRouteDb();
    try {
      mocks.db = routeDb.db;
      const response = await GET();
      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      const body = exerciseCatalogResponseSchema.parse(await response.json());
      expect(body).toMatchObject({
        contractVersion: 'exercise-catalog-contract-2',
        catalogVersion: 'starter-2',
        reviewStatus: 'unreviewed',
      });
      expect(body.exercises.length).toBeGreaterThan(0);
      expect(
        body.exercises.every(
          (entry: { reviewStatus: string }) =>
            entry.reviewStatus === 'unreviewed',
        ),
      ).toBe(true);
      expect(
        body.exercises.find(
          (entry: { id: string }) => entry.id === 'wall-push-up',
        ),
      ).toMatchObject({
        requiredCapabilities: ['wall'],
        environments: ['home', 'gym'],
        reviewedVersion: null,
        reviewedAt: null,
        reviewReference: null,
      });
      for (const equipment of workoutEquipmentSchema.options) {
        for (const environment of workoutEnvironmentSchema.options) {
          const coverage = catalogSetupCoverage(body.exercises, {
            equipment: [equipment],
            environments: [environment],
            injuryFlags: [],
            clinicianRestrictionFlags: [],
            safetyDecision: { status: 'allowed', reasonCodes: [] },
          });
          expect(
            coverage.candidateIds.length > 0 ||
              (coverage.unresolved &&
                coverage.reason === 'no_eligible_exercise'),
          ).toBe(true);
        }
      }
    } finally {
      await routeDb.dispose();
    }
  }, 60_000);

  it('rejects malformed catalog graph data instead of returning it', async () => {
    const row = {
      id: 'broken',
      name: { en: 'Broken', vi: 'Hỏng' },
      category: 'mobility',
      equipment: ['bodyweight'],
      environments: ['home'],
      muscleGroups: ['whole_body'],
      contraindicationTags: [],
      technique: { en: 'Technique', vi: 'Kỹ thuật' },
      regression: { en: 'Regression', vi: 'Điều chỉnh' },
      progression: { en: 'Progression', vi: 'Tăng tiến' },
      substitutionIds: ['missing'],
      catalogVersion: 'starter-2',
      reviewStatus: 'unreviewed',
      reviewedVersion: null,
      reviewedAt: null,
      reviewReference: null,
    };
    mocks.db = createFakeRouteDb({
      rowsByTable: new Map([[exerciseCatalog, [row]]]),
    }).db;
    const response = await GET();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'The exercise catalog is temporarily unavailable.',
    });
  });
});
