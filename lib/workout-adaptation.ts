import type { ExerciseCatalogEntry } from './exercise-catalog';
import { evaluateExerciseCatalog } from './exercise-eligibility';
import type {
  WorkoutPlanningContext,
  WorkoutPlanV2,
} from './workout-planning-contracts';
import type { WorkoutAdaptationPolicy } from './workout-adaptation-policy';
import type { WorkoutAdaptationReason } from './workout-adaptation-contracts';

export type AdaptationEvidence = {
  id: string;
  sessionId: string;
  status: 'completed' | 'stopped_for_safety';
  evidenceVersion: 'legacy-aggregate-1' | 'workout-exercise-evidence-1';
  dataCompleteness: 'legacy_aggregate' | 'exercise_level_complete';
  adherenceStatus:
    | 'legacy_unknown'
    | 'complete'
    | 'partial'
    | 'not_counted_safety_stop';
  rpe: number;
  pain: boolean;
  concerningSymptoms: boolean;
  exerciseResultIds: string[];
};

export type AdaptationRecovery = {
  id: string;
  status: 'good' | 'some_fatigue' | 'poor';
  soreness: boolean;
  pain: boolean;
};

export type WorkoutAdaptationInput = {
  plan: WorkoutPlanV2;
  context: WorkoutPlanningContext;
  progressionSafety: {
    contextVersion: string;
    decision: 'allowed' | 'allowed_with_modifications' | 'blocked';
    reasonCodes: WorkoutPlanningContext['safety']['reasonCodes'];
  };
  catalog: ExerciseCatalogEntry[];
  evidence: AdaptationEvidence[];
  recovery: AdaptationRecovery;
  policy: WorkoutAdaptationPolicy;
};

type Prescription =
  WorkoutPlanV2['sessions'][number]['sections'][number]['prescriptions'][number];

function scale(value: number, percent: number, minimum: number) {
  return Math.max(minimum, Math.floor((value * (100 - percent)) / 100));
}

function mapPlan(
  plan: WorkoutPlanV2,
  transform: (prescription: Prescription, sessionId: string) => Prescription,
) {
  return {
    ...plan,
    sessions: plan.sessions.map((session) => ({
      ...session,
      sections: session.sections.map((section) => ({
        ...section,
        prescriptions: section.prescriptions.map((item) =>
          transform(item, session.id),
        ),
      })),
    })),
  } satisfies WorkoutPlanV2;
}

export function createWorkoutAdaptation(input: WorkoutAdaptationInput) {
  const evidenceIds = input.evidence.flatMap((log) => [
    log.id,
    ...log.exerciseResultIds,
  ]);
  const result = (
    action:
      | 'hold_for_review'
      | 'maintain'
      | 'progress'
      | 'deload'
      | 'substitute',
    reasonCodes: WorkoutAdaptationReason[],
    proposedPlan: WorkoutPlanV2 | null,
    changes: Array<{
      sessionId: string;
      exerciseId: string;
      before: Prescription;
      after: Prescription | null;
      reasonCode: WorkoutAdaptationReason;
    }>,
    unresolvedQuestions: Array<{
      code:
        | 'professional_review_required'
        | 'eligible_substitution_required'
        | 'more_exercise_evidence_required';
      exerciseIds: string[];
    }> = [],
  ) => ({
    action,
    reasonCodes,
    proposedPlan,
    changes,
    unresolvedQuestions,
    evidenceRecordIds: [...new Set([...evidenceIds, input.recovery.id])].sort(),
    dataCompleteness:
      action === 'progress'
        ? ('complete' as const)
        : input.evidence.length
          ? ('partial' as const)
          : ('insufficient' as const),
    confidence:
      action === 'progress'
        ? ('high' as const)
        : action === 'maintain' && input.evidence.length === 0
          ? ('low' as const)
          : ('moderate' as const),
  });

  if (input.progressionSafety.decision === 'blocked')
    return result('hold_for_review', ['safety_blocked'], null, []);
  if (
    input.evidence.some(
      (log) =>
        log.status === 'stopped_for_safety' ||
        log.pain ||
        log.concerningSymptoms,
    )
  )
    return result('hold_for_review', ['concerning_workout_evidence'], null, []);
  if (input.recovery.pain)
    return result('hold_for_review', ['recovery_pain'], null, []);

  const eligibility = new Map(
    evaluateExerciseCatalog(input.catalog, {
      equipment: input.context.equipmentCapabilities,
      environments: input.context.environments,
      injuryFlags: input.context.injuryFlags,
      clinicianRestrictionFlags: input.context.clinicianRestrictionFlags,
      safetyDecision: {
        status: input.context.safety.decision,
        reasonCodes: input.context.safety.reasonCodes,
      },
    }).map((item) => [item.exerciseId, item]),
  );
  const substitutions = new Map<string, string>();
  const unresolved: string[] = [];
  for (const prescription of input.plan.sessions.flatMap((session) =>
    session.sections.flatMap((section) => section.prescriptions),
  )) {
    const status = eligibility.get(prescription.exerciseId);
    if (status?.eligible) continue;
    const replacement = status?.eligibleSubstitutionIds.find((id) =>
      prescription.substitutionIds.includes(id),
    );
    if (replacement) substitutions.set(prescription.exerciseId, replacement);
    else unresolved.push(prescription.exerciseId);
  }
  if (substitutions.size || unresolved.length) {
    if (unresolved.length)
      return result(
        'substitute',
        ['exercise_incompatible', 'substitution_unresolved'],
        null,
        [],
        [
          {
            code: 'eligible_substitution_required',
            exerciseIds: [...new Set(unresolved)].sort(),
          },
        ],
      );
    const changes: ReturnType<typeof result>['changes'] = [];
    const proposedPlan = mapPlan(input.plan, (before, sessionId) => {
      const replacement = substitutions.get(before.exerciseId);
      if (!replacement) return before;
      const after = { ...before, exerciseId: replacement, substitutionIds: [] };
      changes.push({
        sessionId,
        exerciseId: before.exerciseId,
        before,
        after,
        reasonCode: 'exercise_incompatible',
      });
      return after;
    });
    return result(
      'substitute',
      ['exercise_incompatible'],
      proposedPlan,
      changes,
    );
  }

  const targetRpe =
    input.plan.sessions.reduce((sum, session) => sum + session.targetRpe, 0) /
    input.plan.sessions.length;
  const averageRpe = input.evidence.length
    ? input.evidence.reduce((sum, log) => sum + log.rpe, 0) /
      input.evidence.length
    : null;
  if (
    input.recovery.status === 'poor' ||
    (averageRpe !== null &&
      averageRpe - targetRpe >= input.policy.excessRpeDelta)
  ) {
    const reason: WorkoutAdaptationReason =
      input.recovery.status === 'poor' ? 'poor_recovery' : 'excess_effort';
    const changes: ReturnType<typeof result>['changes'] = [];
    const proposedPlan = mapPlan(input.plan, (before, sessionId) => {
      const after = {
        ...before,
        sets:
          before.sets === null
            ? null
            : scale(
                before.sets,
                input.policy.deloadPercent,
                input.policy.minimumSets,
              ),
        reps:
          before.reps === null
            ? null
            : scale(
                before.reps,
                input.policy.deloadPercent,
                input.policy.minimumReps,
              ),
        durationMinutes:
          before.durationMinutes === null
            ? null
            : scale(
                before.durationMinutes,
                input.policy.deloadPercent,
                input.policy.minimumDurationMinutes,
              ),
        targetRpe: Math.max(
          1,
          before.targetRpe - input.policy.targetRpeReduction,
        ),
      };
      changes.push({
        sessionId,
        exerciseId: before.exerciseId,
        before,
        after,
        reasonCode: reason,
      });
      return after;
    });
    return result('deload', [reason], proposedPlan, changes);
  }
  if (input.recovery.status === 'some_fatigue')
    return result('maintain', ['some_fatigue'], input.plan, []);
  const duplicateSessions =
    new Set(input.evidence.map((log) => log.sessionId)).size !==
    input.evidence.length;
  if (duplicateSessions)
    return result(
      'maintain',
      ['duplicate_session_evidence'],
      input.plan,
      [],
      [{ code: 'more_exercise_evidence_required', exerciseIds: [] }],
    );
  if (
    input.evidence.some((log) => log.evidenceVersion === 'legacy-aggregate-1')
  )
    return result(
      'maintain',
      ['legacy_evidence'],
      input.plan,
      [],
      [{ code: 'more_exercise_evidence_required', exerciseIds: [] }],
    );
  const adherence = input.evidence.length
    ? input.evidence.reduce(
        (sum, log) =>
          sum +
          (log.adherenceStatus === 'complete'
            ? 1
            : log.adherenceStatus === 'partial'
              ? 0.5
              : 0),
        0,
      ) / input.evidence.length
    : 0;
  if (
    input.evidence.length < input.policy.minimumCompleteSessions ||
    adherence < input.policy.minimumAdherenceRatio
  )
    return result(
      'maintain',
      ['insufficient_evidence'],
      input.plan,
      [],
      [{ code: 'more_exercise_evidence_required', exerciseIds: [] }],
    );
  if (
    input.policy.reviewStatus !== 'professionally_reviewed' ||
    input.plan.policy.reviewStatus !== 'professionally_reviewed'
  )
    return result(
      'maintain',
      ['progression_policy_unreviewed'],
      input.plan,
      [],
      [{ code: 'professional_review_required', exerciseIds: [] }],
    );
  if (
    averageRpe === null ||
    averageRpe - targetRpe > input.policy.progressionMaximumRpeDelta
  )
    return result('maintain', ['maintenance_appropriate'], input.plan, []);
  const changes: ReturnType<typeof result>['changes'] = [];
  const proposedPlan = mapPlan(input.plan, (before, sessionId) => {
    const after = {
      ...before,
      reps:
        before.reps === null
          ? null
          : Math.min(
              input.policy.maximumReps,
              before.reps + input.policy.progressionRepIncrease,
            ),
      durationMinutes:
        before.durationMinutes === null
          ? null
          : Math.min(
              input.policy.maximumDurationMinutes,
              before.durationMinutes +
                input.policy.progressionDurationIncreaseMinutes,
            ),
    };
    changes.push({
      sessionId,
      exerciseId: before.exerciseId,
      before,
      after,
      reasonCode: 'progression_criteria_met',
    });
    return after;
  });
  return result(
    'progress',
    ['progression_criteria_met'],
    proposedPlan,
    changes,
  );
}
