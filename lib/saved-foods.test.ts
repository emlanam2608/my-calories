import { describe, expect, it } from 'vitest';
import { normalizePersonalFoodName } from './saved-food-normalization';

describe('personal food names', () => {
  it('matches Vietnamese accents and repeated whitespace consistently', () => {
    expect(normalizePersonalFoodName('  Cơm   gà  ')).toBe('com ga');
    expect(normalizePersonalFoodName('COM GA')).toBe('com ga');
  });
});
