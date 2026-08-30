import { describe, expect, it } from 'vitest';
import { createStarterWorkoutPlan } from './workout-plan';
import type { ExerciseCatalogEntry } from './exercise-catalog';

const catalog = [
  ['cat-cow', 'exercise mat', 'mobility'],
  ['sit-to-stand', 'chair', 'strength'],
  ['wall-push-up', 'wall', 'strength'],
  ['treadmill-walk', 'mini treadmill', 'aerobic'],
  ['bicycle-easy', 'bicycle', 'aerobic'],
  ['band-row', 'resistance band', 'strength'],
].map(([id, equipment, category]) => ({ id, equipment: [equipment], category })) as ExerciseCatalogEntry[];

describe('createStarterWorkoutPlan', () => {
  it('creates three conservative sessions from the approved starter catalog', () => {
    const plan = createStarterWorkoutPlan(catalog, '2026-08-31');
    expect(plan.sessions).toHaveLength(3);
    expect(plan.sessions.every((session) => session.rpe <= 3)).toBe(true);
    expect(plan.sessions.flatMap((session) => session.exerciseIds)).toContain('sit-to-stand');
  });

  it('does not generate a plan if a required catalog movement is unavailable', () => {
    expect(() => createStarterWorkoutPlan(catalog.slice(1), '2026-08-31')).toThrow('selected equipment');
  });

  it('excludes strength work when a clinician restriction is recorded', () => {
    const plan = createStarterWorkoutPlan(catalog, '2026-08-31', {
      equipment: ['exercise_mat', 'mini_treadmill'],
      clinicianRestrictionFlags: ['avoid_resistance'],
    });
    expect(plan.sessions.flatMap((session) => session.exerciseIds)).not.toContain('sit-to-stand');
    expect(plan.sessions.flatMap((session) => session.exerciseIds)).toContain('treadmill-walk');
  });

  it('does not use an exercise whose equipment was not selected', () => {
    expect(() => createStarterWorkoutPlan(catalog, '2026-08-31', {
      equipment: ['exercise_mat', 'bicycle'],
      clinicianRestrictionFlags: [],
    })).toThrow('selected equipment');
  });
});
