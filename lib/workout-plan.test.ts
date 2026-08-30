import { describe, expect, it } from 'vitest';
import { createStarterWorkoutPlan } from './workout-plan';
import type { ExerciseCatalogEntry } from './exercise-catalog';

const catalog = ['cat-cow', 'sit-to-stand', 'wall-push-up', 'treadmill-walk', 'bicycle-easy', 'band-row'].map((id) => ({ id })) as ExerciseCatalogEntry[];

describe('createStarterWorkoutPlan', () => {
  it('creates three conservative sessions from the approved starter catalog', () => {
    const plan = createStarterWorkoutPlan(catalog, '2026-08-31');
    expect(plan.sessions).toHaveLength(3);
    expect(plan.sessions.every((session) => session.rpe <= 3)).toBe(true);
    expect(plan.sessions.flatMap((session) => session.exerciseIds)).toContain('band-row');
  });

  it('does not generate a plan if a required catalog movement is unavailable', () => {
    expect(() => createStarterWorkoutPlan(catalog.slice(1), '2026-08-31')).toThrow('incomplete');
  });
});
