import { describe, expect, it } from 'vitest';
import {
  ACTIVE_EXERCISE_CATALOG_VERSION,
  catalogReviewStatus,
  exerciseCatalogEntrySchema,
  parseExerciseCatalogRow,
  validateExerciseCatalog,
  type ExerciseCatalogEntry,
} from './exercise-catalog';

function entry(
  overrides: Partial<ExerciseCatalogEntry> = {},
): ExerciseCatalogEntry {
  return exerciseCatalogEntrySchema.parse({
    id: 'wall-push-up',
    name: { en: 'Wall push-up', vi: 'Chống đẩy tường' },
    category: 'strength',
    requiredCapabilities: ['wall'],
    environments: ['home', 'gym'],
    muscleGroups: ['chest'],
    contraindicationTags: ['wrist_pain'],
    technique: { en: 'Keep a long spine.', vi: 'Giữ cột sống thẳng.' },
    regression: { en: 'Stand closer.', vi: 'Đứng gần tường hơn.' },
    progression: { en: 'Lower the hands.', vi: 'Hạ vị trí tay.' },
    substitutionIds: [],
    catalogVersion: ACTIVE_EXERCISE_CATALOG_VERSION,
    reviewStatus: 'unreviewed',
    reviewedVersion: null,
    reviewedAt: null,
    reviewReference: null,
    ...overrides,
  });
}

describe('exercise catalog governance', () => {
  it('parses canonical capabilities, environments, and explicit unreviewed metadata', () => {
    expect(
      parseExerciseCatalogRow({
        ...entry(),
        equipment: ['wall'],
      }),
    ).toMatchObject({
      requiredCapabilities: ['wall'],
      environments: ['home', 'gym'],
      reviewStatus: 'unreviewed',
    });
  });

  it('requires complete evidence before professional review can be claimed', () => {
    expect(() => entry({ reviewStatus: 'professionally_reviewed' })).toThrow(
      'require version, date, and reference',
    );
    const reviewed = entry({
      reviewStatus: 'professionally_reviewed',
      reviewedVersion: 'starter-2',
      reviewedAt: '2026-09-06',
      reviewReference: 'review-record-1',
    });
    expect(catalogReviewStatus([reviewed])).toBe('professionally_reviewed');
    expect(catalogReviewStatus([reviewed, entry({ id: 'other' })])).toBe(
      'unreviewed',
    );
  });

  it('rejects unknown capability, environment, and contraindication values', () => {
    for (const patch of [
      { requiredCapabilities: ['future_machine'] },
      { environments: ['clinic'] },
      { contraindicationTags: ['unknown_pain'] },
    ])
      expect(() =>
        exerciseCatalogEntrySchema.parse({ ...entry(), ...patch }),
      ).toThrow();
  });

  it('rejects dangling and self substitutions and sorts valid output deterministically', () => {
    expect(() =>
      validateExerciseCatalog([entry({ substitutionIds: ['missing'] })]),
    ).toThrow('dangling substitution');
    expect(() =>
      validateExerciseCatalog([entry({ substitutionIds: ['wall-push-up'] })]),
    ).toThrow('cannot substitute itself');
    expect(
      validateExerciseCatalog([
        entry({ id: 'z-strength' }),
        entry({ id: 'a-aerobic', category: 'aerobic' }),
      ]).map((item) => item.id),
    ).toEqual(['a-aerobic', 'z-strength']);
  });
});
