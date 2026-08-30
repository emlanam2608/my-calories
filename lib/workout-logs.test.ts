import { describe, expect, it } from 'vitest';
import { workoutLogRequestSchema } from './contracts';

const baseLog = {
  idempotencyKey: 'c1a239b1-6aec-4e9d-a6c8-c18ee8a5d0b4',
  planId: 'b593c8c8-0e10-4c37-95d9-e0e0f13eac31',
  sessionId: 'starter-aerobic',
  durationMinutes: 20,
  rpe: 3,
  enjoyment: 4,
  pain: false,
  concerningSymptoms: false,
};

describe('workout log contract', () => {
  it('accepts conservative completed-session feedback', () => {
    expect(workoutLogRequestSchema.safeParse(baseLog).success).toBe(true);
  });

  it('does not accept high effort with reported pain', () => {
    expect(
      workoutLogRequestSchema.safeParse({ ...baseLog, pain: true, rpe: 8 }).success,
    ).toBe(false);
  });
});
