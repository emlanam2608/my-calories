import { describe, expect, it } from 'vitest';
import { buildAnalytics } from './analytics';

describe('buildAnalytics', () => {
  it('aggregates nutrition, measurement trends, workouts, and observed-day coverage', () => {
    const analytics = buildAnalytics({
      periodDays: 7,
      meals: [
        { occurredAt: new Date('2026-08-31T01:00:00.000Z'), calories: 400, protein: 20, fiber: 5, sodium: 600 },
        { occurredAt: new Date('2026-08-31T05:00:00.000Z'), calories: 300, protein: 10, fiber: 3, sodium: 400 },
      ],
      measurements: [
        { metric: 'weight', value: 70, unit: 'kg', occurredAt: new Date('2026-08-30T01:00:00.000Z') },
        { metric: 'weight', value: 69.5, unit: 'kg', occurredAt: new Date('2026-08-31T01:00:00.000Z') },
      ],
      workouts: [
        { status: 'completed', durationMinutes: 20, completedAt: new Date('2026-08-31T03:00:00.000Z') },
        { status: 'stopped_for_safety', durationMinutes: 5, completedAt: new Date('2026-08-30T03:00:00.000Z') },
      ],
    });
    expect(analytics.dailyNutrition).toContainEqual(expect.objectContaining({ calories: 700, protein: 30, mealCount: 2 }));
    expect(analytics.measurementTrends).toContainEqual(expect.objectContaining({ metric: 'weight', change: -0.5, sampleSize: 2 }));
    expect(analytics.workout).toEqual({ completedSessions: 1, stoppedForSafety: 1, totalMinutes: 20 });
    expect(analytics.completeness).toEqual({ observedDays: 2, coveragePercent: 29 });
  });
});
