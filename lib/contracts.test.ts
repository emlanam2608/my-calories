import { describe, expect, it } from 'vitest';
import { measurementCreateRequestSchema, nutritionSnapshotSchema } from './contracts';

const baseMeasurement = {
  idempotencyKey: 'c1a239b1-6aec-4e9d-a6c8-c18ee8a5d0b4',
  value: 34.6,
  unit: 'ng/mL',
  occurredAt: '2026-08-30T08:00:00.000Z',
  source: 'manual' as const,
};

describe('measurement contracts', () => {
  it('accepts a named custom lab result in its entered unit', () => {
    expect(
      measurementCreateRequestSchema.safeParse({
        ...baseMeasurement,
        metric: 'custom_lab',
        label: 'Vitamin D',
      }).success,
    ).toBe(true);
  });

  it('requires a name for a custom lab result', () => {
    expect(
      measurementCreateRequestSchema.safeParse({
        ...baseMeasurement,
        metric: 'custom_lab',
      }).success,
    ).toBe(false);
  });

  it('keeps standard metric units strict', () => {
    expect(
      measurementCreateRequestSchema.safeParse({
        ...baseMeasurement,
        metric: 'weight',
      }).success,
    ).toBe(false);
  });
});

describe('additional nutrient contracts', () => {
  const snapshot = {
    totals: { calories: 200, protein: 10, fiber: 3, sodium: 120 },
    servingDescription: '1 serving',
    source: 'manual_entry' as const,
    sourceVersion: 'test',
    estimationLevel: 'user_confirmed' as const,
    ingredients: ['Example food'],
  };

  it('keeps missing nutrient fields absent instead of converting them to zero', () => {
    const parsed = nutritionSnapshotSchema.parse(snapshot);
    expect(parsed.additionalNutrients).toBeUndefined();
  });

  it('distinguishes a reported zero from unavailable nutrient data', () => {
    const parsed = nutritionSnapshotSchema.parse({
      ...snapshot,
      additionalNutrients: {
        addedSugar: { value: 0, unit: 'g', state: 'reported' },
        alcohol: { value: null, unit: 'g', state: 'unavailable' },
      },
    });
    expect(parsed.additionalNutrients?.addedSugar?.value).toBe(0);
    expect(parsed.additionalNutrients?.alcohol?.value).toBeNull();
  });
});
