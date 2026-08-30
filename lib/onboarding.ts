import type { OnboardingDraft } from './contracts';

export function onboardingStatus(draft: OnboardingDraft) {
  const complete = Boolean(
    draft.goal &&
      draft.heightCm &&
      draft.ageYears &&
      draft.sexForMetabolicCalculation &&
      draft.activityLevel &&
      draft.trainingHistory &&
      draft.availableDays?.length &&
      draft.equipment?.length,
  );
  return complete ? 'complete' : 'in_progress' as const;
}
