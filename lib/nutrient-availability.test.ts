import { describe, expect, it } from 'vitest';
import { readNutrient } from './nutrient-availability';

describe('readNutrient', () => {
  it('preserves reported zero as available', () => {
    expect(readNutrient({ potassium: { value: 0, unit: 'mg', state: 'reported' } }, 'potassium', ['mg'])).toEqual({
      state: 'available', key: 'potassium', value: 0, unit: 'mg', sourceState: 'reported',
    });
  });

  it('keeps missing and explicitly unavailable values non-numeric', () => {
    expect(readNutrient(undefined, 'iron', ['mg'])).toEqual({ state: 'unavailable', key: 'iron', unit: null });
    expect(readNutrient({ iron: { value: null, unit: 'mg', state: 'unavailable' } }, 'iron', ['mg'])).toEqual({
      state: 'unavailable', key: 'iron', unit: 'mg',
    });
  });

  it('rejects unsupported units without converting them to zero', () => {
    expect(readNutrient({ calcium: { value: 1, unit: 'g', state: 'estimated' } }, 'calcium', ['mg'])).toEqual({
      state: 'unsupported_unit', key: 'calcium', unit: 'g',
    });
  });
});
