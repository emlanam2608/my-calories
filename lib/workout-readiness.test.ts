import { describe, expect, it } from 'vitest';
import { evaluateWorkoutReadiness } from './workout-readiness';

const noFlags = {
  chestPain: false,
  faintingOrDizziness: false,
  severeShortnessOfBreath: false,
  irregularHeartbeat: false,
  clinicianRestriction: false,
  exerciseGlucoseRisk: false,
};

describe('evaluateWorkoutReadiness', () => {
  it('clears a fully negative readiness screen', () => {
    expect(evaluateWorkoutReadiness(noFlags)).toEqual({
      flags: [],
      status: 'cleared',
    });
  });

  it('pauses plan generation when any gate flag is reported', () => {
    expect(
      evaluateWorkoutReadiness({ ...noFlags, chestPain: true }),
    ).toEqual({ flags: ['chestPain'], status: 'needs_review' });
  });
});
