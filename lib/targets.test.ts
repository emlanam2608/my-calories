import { describe, expect, it } from 'vitest';
import { defaultTargets, selectTargets } from './targets';

describe('selectTargets', () => {
  it('uses guideline defaults when no valid saved target exists', () => {
    expect(selectTargets([])).toEqual(defaultTargets.map((target) => ({ ...target, authority: 'guideline_default' })));
  });

  it('gives clinician-defined targets precedence over user and guideline targets', () => {
    const targets = selectTargets([
      { metric: 'calories', valueScaled: 170000, valueScale: 100, unit: 'kcal', authority: 'guideline_default', updatedAt: new Date('2026-01-03') },
      { metric: 'calories', valueScaled: 190000, valueScale: 100, unit: 'kcal', authority: 'user_defined', updatedAt: new Date('2026-01-02') },
      { metric: 'calories', valueScaled: 160000, valueScale: 100, unit: 'kcal', authority: 'clinician_defined', updatedAt: new Date('2026-01-01') },
    ]);

    expect(targets.find((target) => target.metric === 'calories')).toEqual({
      metric: 'calories', value: 1600, unit: 'kcal', authority: 'clinician_defined',
    });
  });

  it('uses the newest target when candidates have the same authority', () => {
    const targets = selectTargets([
      { metric: 'protein', valueScaled: 8000, valueScale: 100, unit: 'g', authority: 'user_defined', updatedAt: new Date('2026-02-01') },
      { metric: 'protein', valueScaled: 11000, valueScale: 100, unit: 'g', authority: 'user_defined', updatedAt: new Date('2026-02-02') },
    ]);

    expect(targets.find((target) => target.metric === 'protein')).toEqual({
      metric: 'protein', value: 110, unit: 'g', authority: 'user_defined',
    });
  });

  it('ignores invalid authorities and invalid scaled target values', () => {
    const targets = selectTargets([
      { metric: 'sodium', valueScaled: 150000, valueScale: 100, unit: 'mg', authority: 'unsupported', updatedAt: new Date('2026-02-03') },
      { metric: 'sodium', valueScaled: 150000, valueScale: 0, unit: 'mg', authority: 'clinician_defined', updatedAt: new Date('2026-02-03') },
      { metric: 'sodium', valueScaled: -100, valueScale: 100, unit: 'mg', authority: 'clinician_defined', updatedAt: new Date('2026-02-03') },
    ]);

    expect(targets.find((target) => target.metric === 'sodium')).toEqual({
      metric: 'sodium', value: 2000, unit: 'mg', authority: 'guideline_default',
    });
  });
});
