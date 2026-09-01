import {
  effectiveSafetyContextSchema,
  type EffectiveSafetyContext,
  type OnboardingDraft,
  type SafetyDecisionDomain,
  type SafetyReasonCode,
} from './contracts';
import type { WorkoutReadinessFlag } from './workout-readiness';
import {
  EXERCISE_GLUCOSE_EVIDENCE_SOURCE,
  EXERCISE_GLUCOSE_POLICY_VERSION,
  evaluateExerciseGlucose,
} from './exercise-glucose-policy';

export const EFFECTIVE_SAFETY_CONTEXT_VERSION = 'effective-safety-context-1' as const;
export const WORKOUT_READINESS_VALID_DAYS = 90;
export const RECENT_WORKOUT_SAFETY_DAYS = 14;

type ReadinessInput = {
  id: string;
  status: 'cleared' | 'needs_review';
  flags: WorkoutReadinessFlag[];
  confirmedAt: Date;
};

type WorkoutLogInput = {
  id: string;
  completedAt: Date | null;
  pain: boolean;
  concerningSymptoms: boolean;
  preGlucose: number | null;
  postGlucose: number | null;
};

export type EffectiveSafetyContextInput = {
  now: Date;
  onboarding?: {
    id: string;
    updatedAt: Date;
    draft: OnboardingDraft;
  };
  readiness?: ReadinessInput;
  workoutLogs?: WorkoutLogInput[];
};

type DecisionStatus = EffectiveSafetyContext['decisions']['workout_plan']['status'];
type ReasonRule = {
  code: SafetyReasonCode;
  status: DecisionStatus;
  domains: SafetyDecisionDomain[];
};

const allDomains: SafetyDecisionDomain[] = [
  'workout_plan',
  'workout_progression',
  'coach_exercise',
];

const statusRank: Record<DecisionStatus, number> = {
  allowed: 0,
  allowed_with_modifications: 1,
  blocked: 2,
};

function days(milliseconds: number) {
  return milliseconds / 86_400_000;
}

function isRecent(recordedAt: Date | null, now: Date, maximumDays: number) {
  if (!recordedAt || !Number.isFinite(recordedAt.getTime())) return false;
  const age = days(now.getTime() - recordedAt.getTime());
  return age >= 0 && age <= maximumDays;
}

function glucoseFact(
  logs: WorkoutLogInput[],
  key: 'preGlucose' | 'postGlucose',
) {
  const source = logs.find((log) => log[key] !== null);
  if (!source) {
    const policy = evaluateExerciseGlucose(key === 'preGlucose' ? 'pre' : 'post', null, 'mmol/L');
    return {
      state: 'missing' as const,
      policyStatus: policy.status,
      valueMmolL: null,
      sourceRecordId: null,
      recordedAt: null,
    };
  }
  const value = source[key];
  const policy = evaluateExerciseGlucose(key === 'preGlucose' ? 'pre' : 'post', value, 'mmol/L');
  if (policy.status === 'invalid')
    return {
      state: 'invalid' as const,
      policyStatus: policy.status,
      valueMmolL: null,
      sourceRecordId: source.id,
      recordedAt: source.completedAt?.toISOString() ?? null,
    };
  return {
    state: 'reported' as const,
    policyStatus: policy.status,
    valueMmolL: policy.valueMmolL,
    sourceRecordId: source.id,
    recordedAt: source.completedAt?.toISOString() ?? null,
  };
}

export function resolveEffectiveSafetyContext(
  input: EffectiveSafetyContextInput,
): EffectiveSafetyContext {
  const { now, onboarding, readiness } = input;
  const logs = [...(input.workoutLogs ?? [])]
    .filter((log) => isRecent(log.completedAt, now, RECENT_WORKOUT_SAFETY_DAYS))
    .sort((a, b) =>
      (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0) ||
      a.id.localeCompare(b.id),
    );
  const ageYears = onboarding?.draft.ageYears ?? null;
  const eligibility = ageYears === null
    ? 'unknown'
    : ageYears < 18
      ? 'under_18'
      : 'adult';
  const readinessTimestampIsValid = Boolean(
    readiness &&
    Number.isFinite(readiness.confirmedAt.getTime()) &&
    readiness.confirmedAt.getTime() <= now.getTime(),
  );
  const readinessIsStale = readiness && readinessTimestampIsValid
    ? days(now.getTime() - readiness.confirmedAt.getTime()) > WORKOUT_READINESS_VALID_DAYS
    : false;
  const readinessState = !readiness
    ? 'missing'
    : !readinessTimestampIsValid
      ? 'invalid'
    : readinessIsStale
      ? 'stale'
      : readiness.status;
  const rules: ReasonRule[] = [];
  const preGlucose = glucoseFact(logs, 'preGlucose');
  const postGlucose = glucoseFact(logs, 'postGlucose');
  const add = (
    condition: boolean,
    code: SafetyReasonCode,
    status: DecisionStatus,
    domains = allDomains,
  ) => {
    if (condition) rules.push({ code, status, domains });
  };

  add(eligibility === 'unknown', 'age_unconfirmed', 'blocked');
  add(eligibility === 'under_18', 'under_18', 'blocked');
  add(onboarding?.draft.pregnancyContext === 'pregnant', 'pregnancy_review', 'blocked');
  add(onboarding?.draft.pregnancyContext === 'postpartum', 'postpartum_review', 'blocked');
  add(onboarding?.draft.pregnancyContext === 'unsure', 'pregnancy_context_unsure', 'blocked');

  const medicationFlags = onboarding?.draft.medicationExerciseRiskFlags ?? [];
  add(medicationFlags.includes('glucose_lowering_without_plan'), 'medication_glucose_risk', 'blocked');
  add(medicationFlags.includes('dizziness_or_fainting_risk'), 'medication_dizziness_risk', 'blocked');
  add(medicationFlags.includes('other_exercise_restriction'), 'medication_other_restriction', 'blocked');

  add(!readiness, 'readiness_missing', 'blocked');
  add(Boolean(readiness && !readinessTimestampIsValid), 'readiness_invalid', 'blocked');
  add(readinessIsStale, 'readiness_stale', 'blocked');
  const readinessReasons: Array<[WorkoutReadinessFlag, SafetyReasonCode]> = [
    ['chestPain', 'readiness_chest_pain'],
    ['faintingOrDizziness', 'readiness_fainting_or_dizziness'],
    ['severeShortnessOfBreath', 'readiness_severe_shortness_of_breath'],
    ['irregularHeartbeat', 'readiness_irregular_heartbeat'],
    ['clinicianRestriction', 'readiness_clinician_restriction'],
    ['exerciseGlucoseRisk', 'readiness_exercise_glucose_risk'],
  ];
  for (const [flag, reason] of readinessReasons)
    add(Boolean(readiness && readinessTimestampIsValid && !readinessIsStale && readiness.flags.includes(flag)), reason, 'blocked');

  const symptoms = onboarding?.draft.symptomFlags ?? [];
  add(symptoms.includes('chest_discomfort'), 'reported_chest_discomfort', 'blocked');
  add(symptoms.includes('dizziness'), 'reported_dizziness', 'blocked');
  add(symptoms.includes('shortness_of_breath'), 'reported_shortness_of_breath', 'blocked');

  const restrictions = onboarding?.draft.clinicianRestrictionFlags ?? [];
  add(restrictions.includes('avoid_high_intensity'), 'clinician_avoid_high_intensity', 'allowed_with_modifications');
  add(restrictions.includes('avoid_resistance'), 'clinician_avoid_resistance', 'allowed_with_modifications');
  add(restrictions.includes('avoid_impact'), 'clinician_avoid_impact', 'allowed_with_modifications');
  add(restrictions.includes('monitor_glucose'), 'clinician_monitor_glucose', 'allowed_with_modifications');

  const recentPain = logs.some((log) => log.pain);
  const recentSymptoms = logs.some((log) => log.concerningSymptoms);
  add(recentPain, 'recent_workout_pain', 'allowed_with_modifications', ['workout_plan', 'coach_exercise']);
  add(recentPain, 'recent_workout_pain', 'blocked', ['workout_progression']);
  add(recentSymptoms, 'recent_workout_symptoms', 'allowed_with_modifications', ['workout_plan', 'coach_exercise']);
  add(recentSymptoms, 'recent_workout_symptoms', 'blocked', ['workout_progression']);

  const invalidGlucose = preGlucose.policyStatus === 'invalid' || postGlucose.policyStatus === 'invalid';
  add(invalidGlucose, 'glucose_value_invalid', 'allowed_with_modifications', ['workout_plan', 'coach_exercise']);
  add(invalidGlucose, 'glucose_value_invalid', 'blocked', ['workout_progression']);
  add(preGlucose.policyStatus === 'below_review_range', 'pre_glucose_below_review_range', 'blocked');
  add(preGlucose.policyStatus === 'above_review_range', 'pre_glucose_above_review_range', 'blocked');
  add(postGlucose.policyStatus === 'recovery_review', 'post_glucose_recovery_review', 'allowed_with_modifications', ['workout_plan']);
  add(postGlucose.policyStatus === 'recovery_review', 'post_glucose_recovery_review', 'blocked', ['workout_progression', 'coach_exercise']);
  add(postGlucose.policyStatus === 'above_review_range', 'post_glucose_above_review_range', 'allowed_with_modifications', ['workout_plan']);
  add(postGlucose.policyStatus === 'above_review_range', 'post_glucose_above_review_range', 'blocked', ['workout_progression', 'coach_exercise']);

  const decisions = Object.fromEntries(allDomains.map((domain) => {
    const domainRules = rules.filter((rule) => rule.domains.includes(domain));
    const status = domainRules.reduce<DecisionStatus>(
      (current, rule) => statusRank[rule.status] > statusRank[current] ? rule.status : current,
      'allowed',
    );
    const uniqueReasons = [...new Set(domainRules.map((rule) => rule.code))];
    return [domain, {
      status,
      reasons: uniqueReasons.map((code) => ({
        code,
        copyKey: `safetyContext.reasons.${code}`,
      })),
    }];
  })) as EffectiveSafetyContext['decisions'];

  const sources: EffectiveSafetyContext['sources'] = [];
  if (onboarding) sources.push({
    kind: 'onboarding',
    recordId: onboarding.id,
    recordedAt: onboarding.updatedAt.toISOString(),
  });
  if (readiness && readinessTimestampIsValid) sources.push({
    kind: 'readiness',
    recordId: readiness.id,
    recordedAt: readiness.confirmedAt.toISOString(),
  });
  for (const log of logs) {
    if (!log.completedAt) continue;
    sources.push({ kind: 'workout_log', recordId: log.id, recordedAt: log.completedAt.toISOString() });
  }

  return effectiveSafetyContextSchema.parse({
    contextVersion: EFFECTIVE_SAFETY_CONTEXT_VERSION,
    evaluatedAt: now.toISOString(),
    facts: {
      eligibility: { state: eligibility, ageYears },
      pregnancyContext: onboarding?.draft.pregnancyContext ?? null,
      medicationExerciseRiskFlags: medicationFlags,
      readiness: {
        state: readinessState,
        flags: readiness?.flags ?? [],
        confirmedAt: readiness && readinessTimestampIsValid
          ? readiness.confirmedAt.toISOString()
          : null,
      },
      clinicianRestrictionFlags: restrictions,
      recentWorkoutSafety: {
        pain: recentPain,
        concerningSymptoms: recentSymptoms,
        sourceRecordIds: logs
          .filter((log) => log.pain || log.concerningSymptoms)
          .map((log) => log.id),
      },
      glucose: {
        policyVersion: EXERCISE_GLUCOSE_POLICY_VERSION,
        evidenceSource: EXERCISE_GLUCOSE_EVIDENCE_SOURCE,
        pre: preGlucose,
        post: postGlucose,
      },
    },
    decisions,
    sources,
  });
}
