import type { SafetyReasonCode } from './contracts';
import {
  catalogReviewStatus,
  validateExerciseCatalog,
  type ExerciseCatalogEntry,
} from './exercise-catalog';
import {
  evaluateExerciseCatalog,
  type ExerciseEligibilityResult,
} from './exercise-eligibility';
import {
  WORKOUT_PLAN_V2_VERSION,
  WORKOUT_PLANNER_VERSION,
  workoutPlannerResultSchema,
  type WorkoutPlanV2,
  type WorkoutPlanningContext,
  type WorkoutPlannerResult,
} from './workout-planning-contracts';
import { WORKOUT_PRESCRIPTION_POLICY } from './workout-prescription-policy';

type Purpose = WorkoutPlanV2['sessions'][number]['purpose'];
type Prescription =
  WorkoutPlanV2['sessions'][number]['sections'][number]['prescriptions'][number];
type UnresolvedQuestion = WorkoutPlanV2['unresolvedQuestions'][number];

const dayOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

function civilToDays(year: number, month: number, day: number) {
  const adjustedYear = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(adjustedYear / 400);
  const yearOfEra = adjustedYear - era * 400;
  const adjustedMonth = month + (month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * adjustedMonth + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 +
    Math.floor(yearOfEra / 4) -
    Math.floor(yearOfEra / 100) +
    dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

function daysToCivil(serialDay: number) {
  const shifted = serialDay + 719468;
  const era = Math.floor(shifted / 146097);
  const dayOfEra = shifted - era * 146097;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36524) -
      Math.floor(dayOfEra / 146096)) /
      365,
  );
  let year = yearOfEra + era * 400;
  const dayOfYear =
    dayOfEra -
    (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthPart = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthPart + 2) / 5) + 1;
  const month = monthPart + (monthPart < 10 ? 3 : -9);
  year += month <= 2 ? 1 : 0;
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function scheduledDays(
  planningDate: string,
  availableDays: WorkoutPlanningContext['availableDays'],
) {
  const [year, month, day] = planningDate.split('-').map(Number);
  const start = civilToDays(year, month, day);
  const startWeekday = (((start + 3) % 7) + 7) % 7;
  return availableDays
    .map((weekday) => ({
      day: weekday,
      offset: (dayOrder.indexOf(weekday) - startWeekday + 7) % 7,
    }))
    .sort(
      (left, right) =>
        left.offset - right.offset || left.day.localeCompare(right.day),
    )
    .map((scheduled) => ({
      ...scheduled,
      date: daysToCivil(start + scheduled.offset),
    }));
}

function question(
  code: UnresolvedQuestion['code'],
  exerciseIds: string[] = [],
  missingCapabilities: UnresolvedQuestion['missingCapabilities'] = [],
): UnresolvedQuestion {
  return {
    code,
    copyKey: `workoutPlanner.unresolved.${code}`,
    exerciseIds: [...new Set(exerciseIds)].sort(),
    missingCapabilities: [...new Set(missingCapabilities)].sort(),
  };
}

function prescription(
  exercise: ExerciseCatalogEntry,
  eligibility: ExerciseEligibilityResult,
  purpose: Purpose | 'warmup' | 'cooldown',
  targetRpe: number,
  dose: {
    allocatedMinutes: number;
    sets?: number;
    reps?: number;
    durationMinutes?: number;
    restSeconds?: number;
  },
): Prescription {
  return {
    exerciseId: exercise.id,
    allocatedMinutes: dose.allocatedMinutes,
    sets: dose.sets ?? null,
    reps: dose.reps ?? null,
    durationMinutes: dose.durationMinutes ?? null,
    restSeconds: dose.restSeconds ?? null,
    targetRpe,
    rationaleCopyKey: `workoutPlanner.rationale.phase.${purpose}`,
    substitutionIds: eligibility.eligibleSubstitutionIds,
    modificationReasonCodes: eligibility.modificationReasons,
  };
}

export function createDeterministicWorkoutPlan(
  context: WorkoutPlanningContext,
  catalog: ExerciseCatalogEntry[],
): WorkoutPlannerResult {
  if (context.safety.decision === 'blocked')
    return workoutPlannerResultSchema.parse({
      status: 'blocked',
      plan: null,
      reasonCodes: context.safety.reasonCodes,
    });

  const orderedCatalog = validateExerciseCatalog(catalog);
  const eligibility = evaluateExerciseCatalog(orderedCatalog, {
    equipment: context.equipmentCapabilities,
    environments: context.environments,
    injuryFlags: context.injuryFlags,
    clinicianRestrictionFlags: context.clinicianRestrictionFlags,
    safetyDecision: {
      status: context.safety.decision,
      reasonCodes: context.safety.reasonCodes,
    },
  });
  const eligibilityById = new Map(
    eligibility.map((result) => [result.exerciseId, result]),
  );
  const eligibleByPurpose = (purpose: Purpose) =>
    orderedCatalog.filter(
      (entry) =>
        entry.category === purpose && eligibilityById.get(entry.id)?.eligible,
    );
  const candidates = {
    mobility: eligibleByPurpose('mobility'),
    strength: eligibleByPurpose('strength'),
    aerobic: eligibleByPurpose('aerobic'),
  };
  const unresolvedQuestions: UnresolvedQuestion[] = [];
  const scheduled = scheduledDays(
    context.planningDate,
    context.availableDays,
  ).slice(0, WORKOUT_PRESCRIPTION_POLICY.maximumSessionsPerWeek);
  if (scheduled.length === 0)
    unresolvedQuestions.push(question('no_available_day'));
  if (context.environments.length === 0)
    unresolvedQuestions.push(question('missing_environment'));

  const policy =
    WORKOUT_PRESCRIPTION_POLICY.byTrainingHistory[context.trainingHistory];
  const constrained =
    context.safety.decision === 'allowed_with_modifications' ||
    context.clinicianRestrictionFlags.includes('avoid_high_intensity') ||
    context.clinicianRestrictionFlags.includes('avoid_impact');
  const targetRpe = constrained
    ? Math.min(policy.targetRpe, WORKOUT_PRESCRIPTION_POLICY.modifiedMaximumRpe)
    : policy.targetRpe;
  let purposeOrder: Purpose[] = [
    ...WORKOUT_PRESCRIPTION_POLICY.purposeOrderByGoal[context.goal],
  ];
  if (context.clinicianRestrictionFlags.includes('avoid_resistance'))
    purposeOrder = purposeOrder.filter((purpose) => purpose !== 'strength');
  if (purposeOrder.length === 0) purposeOrder = ['mobility'];

  const mobility = candidates.mobility[0];
  if (!mobility && scheduled.length > 0) {
    const relevant = eligibility.filter((result) =>
      orderedCatalog.some(
        (entry) =>
          entry.id === result.exerciseId && entry.category === 'mobility',
      ),
    );
    unresolvedQuestions.push(
      question(
        'missing_mobility_candidate',
        relevant.map((result) => result.exerciseId),
        relevant.flatMap((result) => result.unresolvedRequirements),
      ),
    );
  }

  const sessions: WorkoutPlanV2['sessions'] = [];
  for (const [index, schedule] of scheduled.entries()) {
    const purpose = purposeOrder[index % purposeOrder.length];
    const main = candidates[purpose][0];
    if (!mobility || !main) {
      if (!main) {
        const relevant = eligibility.filter((result) =>
          orderedCatalog.some(
            (entry) =>
              entry.id === result.exerciseId && entry.category === purpose,
          ),
        );
        unresolvedQuestions.push(
          question(
            purpose === 'strength'
              ? 'missing_strength_candidate'
              : purpose === 'aerobic'
                ? 'missing_aerobic_candidate'
                : 'missing_mobility_candidate',
            relevant.map((result) => result.exerciseId),
            relevant.flatMap((result) => result.unresolvedRequirements),
          ),
        );
      }
      continue;
    }
    const mobilityEligibility = eligibilityById.get(mobility.id)!;
    const mainEligibility = eligibilityById.get(main.id)!;
    for (const result of [mobilityEligibility, mainEligibility]) {
      if (result.unresolvedSubstitutionIds.length > 0)
        unresolvedQuestions.push(
          question('unresolved_substitution', [
            result.exerciseId,
            ...result.unresolvedSubstitutionIds,
          ]),
        );
    }
    const mainDose =
      purpose === 'strength'
        ? policy.strength
        : purpose === 'aerobic'
          ? {
              allocatedMinutes: policy.aerobicMinutes,
              durationMinutes: policy.aerobicMinutes,
            }
          : {
              allocatedMinutes: policy.mobilityMinutes,
              durationMinutes: policy.mobilityMinutes,
            };
    sessions.push({
      id: `v2-${schedule.date}-${purpose}-${index + 1}`,
      day: schedule.day,
      date: schedule.date,
      purpose,
      titleCopyKey: `workoutPlanner.session.${purpose}.title`,
      rationaleCopyKeys: [
        `workoutPlanner.rationale.goal.${context.goal}`,
        `workoutPlanner.rationale.experience.${context.trainingHistory}`,
        context.recovery.dataCompleteness === 'none'
          ? 'workoutPlanner.rationale.recoveryUnavailable'
          : 'workoutPlanner.rationale.recoveryEvidenceIncluded',
      ],
      durationMinutes: policy.sessionMinutes,
      targetRpe,
      sections: [
        {
          phase: 'warmup',
          prescriptions: [
            prescription(
              mobility,
              mobilityEligibility,
              'warmup',
              Math.min(targetRpe, 2),
              {
                allocatedMinutes: policy.warmupMinutes,
                durationMinutes: policy.warmupMinutes,
              },
            ),
          ],
        },
        {
          phase: purpose,
          prescriptions: [
            prescription(main, mainEligibility, purpose, targetRpe, mainDose),
          ],
        },
        {
          phase: 'cooldown',
          prescriptions: [
            prescription(mobility, mobilityEligibility, 'cooldown', 1, {
              allocatedMinutes: policy.cooldownMinutes,
              durationMinutes: policy.cooldownMinutes,
            }),
          ],
        },
      ],
      progressionCriteriaCopyKeys: [
        ...WORKOUT_PRESCRIPTION_POLICY.progressionCriteriaCopyKeys,
      ],
    });
  }

  const uniqueQuestions = [
    ...new Map(
      unresolvedQuestions.map((item) => [
        `${item.code}:${item.exerciseIds.join(',')}:${item.missingCapabilities.join(',')}`,
        item,
      ]),
    ).values(),
  ];
  const plan = {
    planVersion: WORKOUT_PLAN_V2_VERSION,
    plannerVersion: WORKOUT_PLANNER_VERSION,
    catalogVersion: orderedCatalog[0]?.catalogVersion ?? 'missing-catalog',
    catalogReviewStatus: catalogReviewStatus(orderedCatalog),
    policy: {
      version: WORKOUT_PRESCRIPTION_POLICY.version,
      reviewStatus: WORKOUT_PRESCRIPTION_POLICY.reviewStatus,
      reviewedVersion: WORKOUT_PRESCRIPTION_POLICY.reviewedVersion,
      reviewedAt: WORKOUT_PRESCRIPTION_POLICY.reviewedAt,
      reviewReference: WORKOUT_PRESCRIPTION_POLICY.reviewReference,
    },
    safetyContextVersion: context.safety.contextVersion,
    inputDigest: context.inputDigest,
    periodStart: context.planningDate,
    timezone: context.timezone,
    draftStatus: uniqueQuestions.length > 0 ? 'incomplete' : 'complete',
    sessions,
    appliedSafetyReasonCodes: context.safety.reasonCodes as SafetyReasonCode[],
    unresolvedQuestions: uniqueQuestions,
  } satisfies WorkoutPlanV2;
  return workoutPlannerResultSchema.parse({
    status: 'draft',
    plan,
    reasonCodes: context.safety.reasonCodes,
  });
}
