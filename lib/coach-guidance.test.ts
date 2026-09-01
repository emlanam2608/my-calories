import { describe, expect, it } from 'vitest';
import { createDailyCoachGuidance } from './coach-guidance';

describe('daily coach guidance', () => {
  it('uses only daily totals and effective targets for its priorities', () => {
    expect(createDailyCoachGuidance(
      { calories: 1_600, protein: 50, fiber: 16, sodium: 2_200 },
      { calories: 1_850, protein: 90, fiber: 28, sodium: 2_000 },
      1,
    )).toEqual({
      remaining: { calories: 250, protein: 40, fiber: 12, sodium: 0 },
      priorities: ['sodium', 'protein', 'fiber'],
    });
  });

  it('has a calm default when no target comparison needs attention', () => {
    expect(createDailyCoachGuidance(
      { calories: 0, protein: 0, fiber: 0, sodium: 0 },
      { calories: 0, protein: 0, fiber: 0, sodium: 0 },
      0,
    ).priorities).toEqual(['balanced']);
  });
});
