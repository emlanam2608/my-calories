import { describe, expect, it } from 'vitest';
import type { FoodAnalysis } from './contracts';
import { reviewNoteOrigin, reviewProvenanceStates, snapshotValueState } from './meal-provenance';

function analysis(overrides: Partial<FoodAnalysis['snapshot']> = {}): FoodAnalysis {
  return {
    name: 'Test', nameVi: 'Thử nghiệm', mealType: 'lunch', confidence: 80, unresolvedQuestions: [],
    snapshot: {
      totals: { calories: 400, protein: 20, fiber: 3, sodium: 500 }, servingDescription: '1 serving',
      source: 'usda_fooddata_central', sourceVersion: 'test-v1', sourceReference: null,
      estimationLevel: 'database_derived', ingredients: ['rice'], ...overrides,
    },
    finding: { code: 'review', severity: 'info', text: 'Review source.' },
    healthFindings: [],
  };
}

describe('meal review provenance', () => {
  it('keeps the five trust concepts ordered and does not invent AI prose', () => {
    expect(reviewProvenanceStates(analysis())).toEqual([
      { concept: 'user_confirmed_fact', status: 'pending' },
      { concept: 'provider_database_value', status: 'present' },
      { concept: 'estimate', status: 'absent' },
      { concept: 'deterministic_rule', status: 'absent' },
      { concept: 'ai_explanation', status: 'absent' },
    ]);
  });

  it('distinguishes an estimate note from provider and user-library notes', () => {
    expect(reviewNoteOrigin(analysis({ source: 'manual_estimate', estimationLevel: 'estimated' }))).toBe('estimate_note');
    expect(reviewNoteOrigin(analysis())).toBe('provider_note');
    expect(reviewNoteOrigin(analysis({ source: 'manual_entry', estimationLevel: 'user_confirmed' }))).toBe('user_library_note');
  });

  it('classifies editable snapshot values without calling them measured facts', () => {
    expect(snapshotValueState(analysis())).toBe('provider_database');
    expect(snapshotValueState(analysis({ source: 'manual_estimate', estimationLevel: 'estimated' }))).toBe('estimate');
    expect(snapshotValueState(analysis({ source: 'manual_entry', estimationLevel: 'user_confirmed' }))).toBe('user_confirmed');
  });
});
