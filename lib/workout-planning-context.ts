import type { EffectiveSafetyContext, OnboardingDraft } from './contracts';
import type { ExerciseCapability } from './exercise-catalog';
import {
  WORKOUT_PLANNING_CONTEXT_VERSION,
  workoutPlanningContextSchema,
  workoutRecoverySummarySchema,
  type WorkoutPlanningContext,
  type WorkoutRecoverySummary,
} from './workout-planning-contracts';

const dayOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

type PlanningOnboarding = {
  recordId: string;
  recordedAt: string;
  draft: OnboardingDraft;
};

type PlanningCurrentPlan = {
  id: string;
  planVersion: string;
  recordedAt: string;
};

type RecoveryInput = Omit<WorkoutRecoverySummary, 'sourceRecordIds'> & {
  sources: Array<{ recordId: string; recordedAt: string }>;
};

export type BuildWorkoutPlanningContextInput = {
  planningDate: string;
  timezone: 'Asia/Bangkok';
  onboarding: PlanningOnboarding;
  safetyContext: EffectiveSafetyContext;
  currentPlan: PlanningCurrentPlan | null;
  recovery: RecoveryInput;
};

function sortedUnique<T extends string>(values: T[]) {
  return [...new Set(values)].sort() as T[];
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export async function buildWorkoutPlanningContext(
  input: BuildWorkoutPlanningContextInput,
): Promise<WorkoutPlanningContext> {
  const draft = input.onboarding.draft;
  if (!draft.goal || !draft.trainingHistory)
    throw new Error(
      'Completed onboarding goal and training history are required.',
    );

  const availableDays = [...new Set(draft.availableDays ?? [])].sort(
    (left, right) => dayOrder.indexOf(left) - dayOrder.indexOf(right),
  );
  const equipmentCapabilities = sortedUnique(
    (draft.equipment ?? []) as ExerciseCapability[],
  );
  const environments = sortedUnique(draft.environments ?? []);
  const injuryFlags = sortedUnique(draft.injuryFlags ?? []);
  const clinicianRestrictionFlags = sortedUnique(
    draft.clinicianRestrictionFlags ?? [],
  );
  const safetyDecision = input.safetyContext.decisions.workout_plan;
  const { sources: recoverySources, ...recoveryValues } = input.recovery;
  const recovery = workoutRecoverySummarySchema.parse({
    ...recoveryValues,
    sourceRecordIds: sortedUnique(
      recoverySources.map((source) => source.recordId),
    ),
  });
  const sourceMap = new Map<
    string,
    WorkoutPlanningContext['sources'][number]
  >();
  const addSource = (source: WorkoutPlanningContext['sources'][number]) => {
    const key = `${source.kind}:${source.recordId}`;
    const existing = sourceMap.get(key);
    if (existing && existing.recordedAt !== source.recordedAt)
      throw new Error(`Conflicting planning source timestamp for ${key}.`);
    sourceMap.set(key, source);
  };
  addSource({
    kind: 'onboarding',
    recordId: input.onboarding.recordId,
    recordedAt: input.onboarding.recordedAt,
  });
  for (const source of input.safetyContext.sources)
    addSource({
      kind: source.kind === 'workout_log' ? 'workout_log' : 'safety_context',
      recordId: source.recordId,
      recordedAt: source.recordedAt,
    });
  if (input.currentPlan)
    addSource({
      kind: 'workout_plan',
      recordId: input.currentPlan.id,
      recordedAt: input.currentPlan.recordedAt,
    });
  for (const source of recoverySources)
    addSource({ kind: 'workout_log', ...source });

  const materialContext = {
    contextVersion: WORKOUT_PLANNING_CONTEXT_VERSION,
    planningDate: input.planningDate,
    timezone: input.timezone,
    goal: draft.goal,
    trainingHistory: draft.trainingHistory,
    availableDays,
    equipmentCapabilities,
    environments,
    injuryFlags,
    clinicianRestrictionFlags,
    safety: {
      contextVersion: input.safetyContext.contextVersion,
      decision: safetyDecision.status,
      reasonCodes: sortedUnique(
        safetyDecision.reasons.map((reason) => reason.code),
      ),
    },
    currentPlan: input.currentPlan
      ? { id: input.currentPlan.id, planVersion: input.currentPlan.planVersion }
      : null,
    recovery,
    sources: [...sourceMap.values()].sort(
      (left, right) =>
        left.kind.localeCompare(right.kind) ||
        left.recordId.localeCompare(right.recordId),
    ),
  };
  return workoutPlanningContextSchema.parse({
    ...materialContext,
    inputDigest: await sha256(materialContext),
  });
}
