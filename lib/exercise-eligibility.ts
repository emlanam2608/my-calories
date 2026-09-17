import type {
  ClinicianRestrictionFlag,
  OnboardingDraft,
  SafetyReasonCode,
} from './contracts';
import type {
  ExerciseCapability,
  ExerciseCatalogEntry,
} from './exercise-catalog';
import { validateExerciseCatalog } from './exercise-catalog';

export const EXERCISE_ELIGIBILITY_VERSION = 'exercise-eligibility-1' as const;

export type ExerciseExclusionReason =
  | 'safety_context_blocked'
  | 'environment_incompatible'
  | 'missing_capability'
  | 'injury_contraindication'
  | 'clinician_avoid_resistance';

export type ExerciseModificationReason =
  | 'clinician_low_intensity_only'
  | 'clinician_low_impact_only'
  | 'clinician_glucose_monitoring_required'
  | 'safety_recent_pain_review'
  | 'safety_recent_symptoms_review'
  | 'safety_glucose_review';

export type ExerciseEligibilityContext = {
  equipment: NonNullable<OnboardingDraft['equipment']>;
  environments: NonNullable<OnboardingDraft['environments']>;
  injuryFlags: NonNullable<OnboardingDraft['injuryFlags']>;
  clinicianRestrictionFlags: ClinicianRestrictionFlag[];
  safetyDecision: {
    status: 'allowed' | 'allowed_with_modifications' | 'blocked';
    reasonCodes: SafetyReasonCode[];
  };
};

export type ExerciseEligibilityResult = {
  exerciseId: string;
  eligible: boolean;
  exclusionReasons: ExerciseExclusionReason[];
  modificationReasons: ExerciseModificationReason[];
  unresolvedRequirements: ExerciseCapability[];
  eligibleSubstitutionIds: string[];
  unresolvedSubstitutionIds: string[];
};

const jointPainTags = new Set([
  'knee_pain',
  'hip_pain',
  'wrist_pain',
  'shoulder_pain',
]);

export function resolveExerciseCapabilities(
  equipment: ExerciseEligibilityContext['equipment'],
) {
  return new Set<ExerciseCapability>(equipment);
}

function baseEligibility(
  entry: ExerciseCatalogEntry,
  context: ExerciseEligibilityContext,
): Omit<
  ExerciseEligibilityResult,
  'eligibleSubstitutionIds' | 'unresolvedSubstitutionIds'
> {
  const capabilities = resolveExerciseCapabilities(context.equipment);
  const unresolvedRequirements = entry.requiredCapabilities.filter(
    (capability) => !capabilities.has(capability),
  );
  const injuryTags = new Set<string>();
  if (context.injuryFlags.includes('back_pain')) injuryTags.add('back_pain');
  if (context.injuryFlags.includes('balance_concern'))
    injuryTags.add('balance_risk');
  if (context.injuryFlags.includes('joint_pain'))
    for (const tag of jointPainTags) injuryTags.add(tag);

  const exclusionReasons: ExerciseExclusionReason[] = [];
  if (context.safetyDecision.status === 'blocked')
    exclusionReasons.push('safety_context_blocked');
  if (
    !entry.environments.some((environment) =>
      context.environments.includes(environment),
    )
  )
    exclusionReasons.push('environment_incompatible');
  if (unresolvedRequirements.length > 0)
    exclusionReasons.push('missing_capability');
  if (entry.contraindicationTags.some((tag) => injuryTags.has(tag)))
    exclusionReasons.push('injury_contraindication');
  if (
    entry.category === 'strength' &&
    context.clinicianRestrictionFlags.includes('avoid_resistance')
  )
    exclusionReasons.push('clinician_avoid_resistance');

  const safetyReasons = new Set(context.safetyDecision.reasonCodes);
  const modificationReasons: ExerciseModificationReason[] = [];
  if (context.clinicianRestrictionFlags.includes('avoid_high_intensity'))
    modificationReasons.push('clinician_low_intensity_only');
  if (context.clinicianRestrictionFlags.includes('avoid_impact'))
    modificationReasons.push('clinician_low_impact_only');
  if (context.clinicianRestrictionFlags.includes('monitor_glucose'))
    modificationReasons.push('clinician_glucose_monitoring_required');
  if (safetyReasons.has('recent_workout_pain'))
    modificationReasons.push('safety_recent_pain_review');
  if (safetyReasons.has('recent_workout_symptoms'))
    modificationReasons.push('safety_recent_symptoms_review');
  if (
    safetyReasons.has('glucose_value_invalid') ||
    safetyReasons.has('post_glucose_recovery_review') ||
    safetyReasons.has('post_glucose_above_review_range')
  )
    modificationReasons.push('safety_glucose_review');

  return {
    exerciseId: entry.id,
    eligible: exclusionReasons.length === 0,
    exclusionReasons,
    modificationReasons,
    unresolvedRequirements,
  };
}

export function evaluateExerciseCatalog(
  catalog: ExerciseCatalogEntry[],
  context: ExerciseEligibilityContext,
) {
  const ordered = validateExerciseCatalog(catalog);
  const byId = new Map(ordered.map((entry) => [entry.id, entry]));
  const base = new Map(
    ordered.map((entry) => [entry.id, baseEligibility(entry, context)]),
  );

  const findEligibleSubstitutions = (entry: ExerciseCatalogEntry) => {
    const eligible = new Set<string>();
    const unresolved = new Set<string>();
    const visited = new Set<string>([entry.id]);
    const visit = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      const candidate = byId.get(id);
      if (!candidate) {
        unresolved.add(id);
        return;
      }
      if (base.get(id)?.eligible) {
        eligible.add(id);
        return;
      }
      if (candidate.substitutionIds.length === 0) unresolved.add(id);
      for (const substitutionId of candidate.substitutionIds)
        visit(substitutionId);
    };
    for (const id of entry.substitutionIds) visit(id);
    if (eligible.size === 0 && unresolved.size === 0)
      for (const id of entry.substitutionIds) unresolved.add(id);
    return {
      eligibleSubstitutionIds: [...eligible].sort(),
      unresolvedSubstitutionIds: [...unresolved].sort(),
    };
  };

  return ordered.map(
    (entry): ExerciseEligibilityResult => ({
      ...base.get(entry.id)!,
      ...findEligibleSubstitutions(entry),
    }),
  );
}

export function eligibleExercises(
  catalog: ExerciseCatalogEntry[],
  context: ExerciseEligibilityContext,
) {
  const eligibleIds = new Set(
    evaluateExerciseCatalog(catalog, context)
      .filter((result) => result.eligible)
      .map((result) => result.exerciseId),
  );
  return validateExerciseCatalog(catalog).filter((entry) =>
    eligibleIds.has(entry.id),
  );
}

export function catalogSetupCoverage(
  catalog: ExerciseCatalogEntry[],
  context: ExerciseEligibilityContext,
) {
  const results = evaluateExerciseCatalog(catalog, context);
  const candidateIds = results
    .filter((result) => result.eligible)
    .map((result) => result.exerciseId);
  return {
    candidateIds,
    unresolved: candidateIds.length === 0,
    reason:
      candidateIds.length === 0 ? ('no_eligible_exercise' as const) : null,
    missingCapabilities: [
      ...new Set(results.flatMap((result) => result.unresolvedRequirements)),
    ].sort(),
  };
}
