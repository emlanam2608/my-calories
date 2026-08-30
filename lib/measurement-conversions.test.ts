import { describe, expect, it } from 'vitest';
import { normalizeMeasurement } from './measurement-conversions';

describe('normalizeMeasurement', () => {
  it('converts pounds to the canonical kilogram unit', () => {
    const result = normalizeMeasurement({ metric: 'weight', value: 220.46226218, unit: 'lb' });
    expect(result.unit).toBe('kg');
    expect(result.value).toBeCloseTo(100, 6);
  });

  it('uses analyte-specific conversion factors', () => {
    expect(normalizeMeasurement({ metric: 'blood_glucose', value: 180.182, unit: 'mg/dL' }).value).toBeCloseTo(10, 6);
    expect(normalizeMeasurement({ metric: 'total_cholesterol', value: 193.35, unit: 'mg/dL' }).value).toBeCloseTo(5, 6);
    expect(normalizeMeasurement({ metric: 'uric_acid', value: 7, unit: 'mg/dL' }).value).toBeCloseTo(416.36, 2);
  });

  it('rejects unsupported unit and analyte combinations', () => {
    expect(() => normalizeMeasurement({ metric: 'blood_glucose', value: 5, unit: 'kg' })).toThrow('Unsupported measurement unit.');
  });
});
