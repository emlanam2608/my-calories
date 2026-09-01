import { describe, expect, it } from 'vitest';
import { bangkokCalendarDate } from './dashboard-client';

describe('dashboard client helpers', () => {
  it('uses the Bangkok calendar date around a UTC day boundary', () => {
    expect(bangkokCalendarDate(new Date('2026-09-01T18:00:00.000Z'))).toBe('2026-09-02');
  });
});
