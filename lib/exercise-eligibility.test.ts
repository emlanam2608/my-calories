import { describe, expect, it } from 'vitest';
import {
  exerciseCatalogEntrySchema,
  type ExerciseCatalogEntry,
} from './exercise-catalog';
import {
  catalogSetupCoverage,
  evaluateExerciseCatalog,
  resolveExerciseCapabilities,
  type ExerciseEligibilityContext,
} from './exercise-eligibility';

function exercise(
  id: string,
  requiredCapabilities: ExerciseCatalogEntry['requiredCapabilities'],
  overrides: Partial<ExerciseCatalogEntry> = {},
): ExerciseCatalogEntry {
  return exerciseCatalogEntrySchema.parse({
    id,
    name: { en: id, vi: `${id}-vi` },
    category: 'mobility',
    requiredCapabilities,
    environments: ['home'],
    muscleGroups: ['whole_body'],
    contraindicationTags: [],
    technique: { en: 'Technique', vi: 'Kỹ thuật' },
    regression: { en: 'Regression', vi: 'Điều chỉnh' },
    progression: { en: 'Progression', vi: 'Tăng tiến' },
    substitutionIds: [],
    catalogVersion: 'starter-2',
    reviewStatus: 'unreviewed',
    reviewedVersion: null,
    reviewedAt: null,
    reviewReference: null,
    ...overrides,
  });
}

const baseContext: ExerciseEligibilityContext = {
  equipment: ['bodyweight'],
  environments: ['home'],
  injuryFlags: [],
  clinicianRestrictionFlags: [],
  safetyDecision: { status: 'allowed', reasonCodes: [] },
};

describe('deterministic exercise eligibility', () => {
  it('does not infer a wall, chair, anchor, or gym machine from bodyweight or gym', () => {
    expect([...resolveExerciseCapabilities(['bodyweight'])]).toEqual([
      'bodyweight',
    ]);
    expect([...resolveExerciseCapabilities(['gym'])]).toEqual(['gym']);
    const results = evaluateExerciseCatalog(
      [
        exercise('bodyweight-march', ['bodyweight']),
        exercise('wall-push-up', ['wall']),
        exercise('band-row', ['resistance_band', 'band_anchor']),
      ],
      baseContext,
    );
    expect(
      results.find((item) => item.exerciseId === 'bodyweight-march')?.eligible,
    ).toBe(true);
    expect(
      results.find((item) => item.exerciseId === 'wall-push-up'),
    ).toMatchObject({
      eligible: false,
      exclusionReasons: ['missing_capability'],
      unresolvedRequirements: ['wall'],
    });
  });

  it('enforces environment compatibility independently of capabilities', () => {
    const [result] = evaluateExerciseCatalog(
      [
        exercise('outdoor-walk', ['bodyweight'], {
          environments: ['outdoors'],
        }),
      ],
      baseContext,
    );
    expect(result.exclusionReasons).toEqual(['environment_incompatible']);
  });

  it.each([
    ['back_pain', 'back_pain'],
    ['joint_pain', 'knee_pain'],
    ['balance_concern', 'balance_risk'],
  ] as const)(
    'maps %s to the catalog contraindication %s',
    (injuryFlag, tag) => {
      const [result] = evaluateExerciseCatalog(
        [exercise('tagged', ['bodyweight'], { contraindicationTags: [tag] })],
        { ...baseContext, injuryFlags: [injuryFlag] },
      );
      expect(result.exclusionReasons).toContain('injury_contraindication');
    },
  );

  it('applies every clinician restriction as an exclusion or stable modification', () => {
    const [result] = evaluateExerciseCatalog(
      [exercise('strength', ['bodyweight'], { category: 'strength' })],
      {
        ...baseContext,
        clinicianRestrictionFlags: [
          'avoid_resistance',
          'avoid_high_intensity',
          'avoid_impact',
          'monitor_glucose',
        ],
      },
    );
    expect(result.exclusionReasons).toContain('clinician_avoid_resistance');
    expect(result.modificationReasons).toEqual([
      'clinician_low_intensity_only',
      'clinician_low_impact_only',
      'clinician_glucose_monitoring_required',
    ]);
  });

  it('gives blocked safety precedence and exposes modification reason codes', () => {
    const [blocked] = evaluateExerciseCatalog(
      [exercise('march', ['bodyweight'])],
      {
        ...baseContext,
        safetyDecision: { status: 'blocked', reasonCodes: ['under_18'] },
      },
    );
    expect(blocked.exclusionReasons[0]).toBe('safety_context_blocked');

    const [modified] = evaluateExerciseCatalog(
      [exercise('march', ['bodyweight'])],
      {
        ...baseContext,
        safetyDecision: {
          status: 'allowed_with_modifications',
          reasonCodes: [
            'recent_workout_pain',
            'recent_workout_symptoms',
            'glucose_value_invalid',
          ],
        },
      },
    );
    expect(modified.modificationReasons).toEqual([
      'safety_recent_pain_review',
      'safety_recent_symptoms_review',
      'safety_glucose_review',
    ]);
  });

  it('terminates cyclic substitution traversal and reports eligible or unresolved alternatives', () => {
    const results = evaluateExerciseCatalog(
      [
        exercise('a', ['wall'], { substitutionIds: ['b'] }),
        exercise('b', ['chair'], { substitutionIds: ['a', 'c'] }),
        exercise('c', ['bodyweight']),
      ],
      baseContext,
    );
    expect(results.find((item) => item.exerciseId === 'a')).toMatchObject({
      eligibleSubstitutionIds: ['c'],
      unresolvedSubstitutionIds: [],
    });
    const cycleOnly = evaluateExerciseCatalog(
      [
        exercise('cycle-a', ['wall'], { substitutionIds: ['cycle-b'] }),
        exercise('cycle-b', ['chair'], { substitutionIds: ['cycle-a'] }),
      ],
      baseContext,
    );
    expect(
      cycleOnly.find((item) => item.exerciseId === 'cycle-a')
        ?.unresolvedSubstitutionIds,
    ).toEqual(['cycle-b']);
  });

  it('returns an explicit unresolved setup instead of guessing a candidate', () => {
    expect(
      catalogSetupCoverage([exercise('wall-only', ['wall'])], baseContext),
    ).toMatchObject({
      candidateIds: [],
      unresolved: true,
      reason: 'no_eligible_exercise',
      missingCapabilities: ['wall'],
    });
  });
});
