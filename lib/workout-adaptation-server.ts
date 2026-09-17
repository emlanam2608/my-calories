import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { workoutExerciseResults, workoutSessions } from '@/db/schema';
import { activeExerciseCatalog } from './exercise-catalog-server';
import {
  createWorkoutAdaptation,
  type AdaptationRecovery,
} from './workout-adaptation';
import { WORKOUT_ADAPTATION_POLICY } from './workout-adaptation-policy';
import type { WorkoutPlanV2 } from './workout-planning-contracts';
import { resolveWorkoutPlanningContext } from './workout-planning-context-server';

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

async function digest(value: unknown) {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const result = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(result), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export async function resolveWorkoutAdaptation(
  ownerId: string,
  planId: string,
  plan: WorkoutPlanV2,
  recovery: AdaptationRecovery,
  now = new Date(),
) {
  const db = getDb();
  const [contextResult, catalog, logs] = await Promise.all([
    resolveWorkoutPlanningContext(ownerId, now),
    activeExerciseCatalog(),
    db
      .select()
      .from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.ownerId, ownerId),
          eq(workoutSessions.planId, planId),
        ),
      )
      .orderBy(desc(workoutSessions.completedAt))
      .limit(42),
  ]);
  if (contextResult.status !== 'ready')
    throw new Error('Planning context is incomplete.');
  const progressionDecision =
    contextResult.safetyContext.decisions.workout_progression;
  const progressionSafety = {
    contextVersion: contextResult.safetyContext.contextVersion,
    decision: progressionDecision.status,
    reasonCodes: progressionDecision.reasons.map((reason) => reason.code),
  };
  const logIds = logs.map((log) => log.id);
  const results =
    logIds.length === 0
      ? []
      : await db
          .select()
          .from(workoutExerciseResults)
          .where(
            and(
              eq(workoutExerciseResults.ownerId, ownerId),
              inArray(workoutExerciseResults.workoutSessionId, logIds),
            ),
          );
  const resultIds = new Map<string, string[]>();
  for (const row of results)
    resultIds.set(row.workoutSessionId, [
      ...(resultIds.get(row.workoutSessionId) ?? []),
      row.id,
    ]);
  const evidence = logs.flatMap((log) =>
    log.sessionId && log.rpe !== null
      ? [
          {
            id: log.id,
            sessionId: log.sessionId,
            status: log.status as 'completed' | 'stopped_for_safety',
            evidenceVersion: log.evidenceVersion as
              | 'legacy-aggregate-1'
              | 'workout-exercise-evidence-1',
            dataCompleteness: log.dataCompleteness as
              | 'legacy_aggregate'
              | 'exercise_level_complete',
            adherenceStatus: log.adherenceStatus as
              | 'legacy_unknown'
              | 'complete'
              | 'partial'
              | 'not_counted_safety_stop',
            rpe: log.rpe,
            pain: log.pain,
            concerningSymptoms: log.concerningSymptoms,
            exerciseResultIds: (resultIds.get(log.id) ?? []).sort(),
          },
        ]
      : [],
  );
  const input = {
    plan,
    context: contextResult.context,
    progressionSafety,
    catalog,
    evidence,
    recovery,
    policy: WORKOUT_ADAPTATION_POLICY,
  };
  return {
    context: contextResult.context,
    catalog,
    evidence,
    result: createWorkoutAdaptation(input),
    inputDigest: await digest({
      basePlanId: contextResult.context.currentPlan?.id,
      planningContextDigest: contextResult.context.inputDigest,
      progressionSafety,
      plan,
      catalog,
      evidence,
      recovery,
      policy: WORKOUT_ADAPTATION_POLICY,
    }),
  };
}
