import { describe, expect, it } from 'vitest';
import { onboardingDraftSchema } from './contracts';
import { onboardingStatus } from './onboarding';

describe('onboarding', () => {
  it('keeps a partial onboarding record resumable', () => {
    const draft = onboardingDraftSchema.parse({ goal: 'health_tracking' });
    expect(onboardingStatus(draft)).toBe('in_progress');
  });

  it('completes only when the safe planning basics are present', () => {
    const draft = onboardingDraftSchema.parse({
      goal: 'fitness', heightCm: 170, ageYears: 32,
      sexForMetabolicCalculation: 'female', activityLevel: 'light',
      trainingHistory: 'beginner', availableDays: ['mon', 'wed'], equipment: ['chair'],
    });
    expect(onboardingStatus(draft)).toBe('complete');
  });

  it('does not accept no symptoms together with a reported symptom', () => {
    expect(() => onboardingDraftSchema.parse({
      symptomFlags: ['none', 'dizziness'],
    })).toThrow('No symptoms');
  });

  it('accepts under-18 and structured pregnancy/medication context for safety gating', () => {
    const draft = onboardingDraftSchema.parse({
      ageYears: 17,
      pregnancyContext: 'unsure',
      medicationExerciseRiskFlags: ['glucose_lowering_without_plan'],
    });
    expect(draft).toMatchObject({ ageYears: 17, pregnancyContext: 'unsure' });
  });

  it('rejects duplicate medication-risk flags', () => {
    expect(() => onboardingDraftSchema.parse({
      medicationExerciseRiskFlags: [
        'dizziness_or_fainting_risk',
        'dizziness_or_fainting_risk',
      ],
    })).toThrow('Each choice');
  });
});
