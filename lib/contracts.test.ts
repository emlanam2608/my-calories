import { describe, expect, it } from 'vitest';
import { measurementCreateRequestSchema } from './contracts';

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
