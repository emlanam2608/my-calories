import { describe, expect, it } from 'vitest';
import { mapPurineIngredients, normalizeIngredient } from './purine-categories';

describe('purine ingredient categories', () => {
  it('normalizes Vietnamese ingredients and returns bilingual category evidence', () => {
    expect(normalizeIngredient('  THỊT BÒ xào  ')).toBe('thit bo xao');
    expect(mapPurineIngredients(['Thịt bò xào'])).toEqual({
      mappingVersion: 'purine-ingredient-categories-1',
      state: 'matched',
      matches: [{ normalizedIngredient: 'thit bo xao', category: 'red_meat', categoryNameEn: 'Red meat', categoryNameVi: 'Thịt đỏ' }],
      unresolvedIngredients: [],
    });
  });

  it('does not use unsafe substring matches', () => {
    const result = mapPurineIngredients(['liverwurst-style seasoning']);
    expect(result.matches).toEqual([]);
    expect(result.state).toBe('unresolved');
    expect(result.unresolvedIngredients).toEqual(['liverwurst style seasoning']);
  });

  it('retains ambiguous recipe detail alongside a category match', () => {
    expect(mapPurineIngredients(['Cá cơm', 'Nước dùng'])).toMatchObject({
      state: 'matched_with_unresolved',
      matches: [{ normalizedIngredient: 'ca com', category: 'small_oily_fish' }],
      unresolvedIngredients: ['nuoc dung'],
    });
  });

  it('deduplicates repeated normalized ingredients', () => {
    const result = mapPurineIngredients(['Beef', '  beef  ', 'THỊT BÒ']);
    expect(result.matches.map((match) => match.normalizedIngredient)).toEqual(['beef', 'thit bo']);
  });

  it('marks a missing ingredient list unresolved without inventing a category', () => {
    expect(mapPurineIngredients([])).toEqual({
      mappingVersion: 'purine-ingredient-categories-1', state: 'unresolved', matches: [],
      unresolvedIngredients: ['ingredient list unavailable'],
    });
  });
});
