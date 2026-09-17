import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import {
  profileOnboarding,
  workoutPlans,
  workoutSessions,
} from '@/db/schema';
import { onboardingDraftSchema } from './contracts';
import { resolveEffectiveSafetyContextForOwner } from './effective-safety-context-server';
import { buildWorkoutPlanningContext } from './workout-planning-context';

function bangkokDate(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export async function resolveWorkoutPlanningContext(
  ownerId: string,
  now = new Date(),
) {
  const db = getDb();
  const recoveryStart = new Date(now.getTime() - 28 * 86_400_000);
  const [onboardingRows, currentPlanRows, logRows, safetyContext] =
    await Promise.all([
      db
        .select()
        .from(profileOnboarding)
        .where(eq(profileOnboarding.ownerId, ownerId))
        .limit(1),
      db
        .select()
        .from(workoutPlans)
        .where(
          and(
            eq(workoutPlans.ownerId, ownerId),
            inArray(workoutPlans.status, ['active', 'confirmed']),
          ),
        )
        .orderBy(desc(workoutPlans.createdAt))
        .limit(1),
      db
        .select()
        .from(workoutSessions)
        .where(
          and(
            eq(workoutSessions.ownerId, ownerId),
            gte(workoutSessions.completedAt, recoveryStart),
          ),
        )
        .orderBy(desc(workoutSessions.completedAt))
        .limit(42),
      resolveEffectiveSafetyContextForOwner(ownerId, now),
    ]);
  const onboarding = onboardingRows[0];
  const draft = onboardingDraftSchema.safeParse(onboarding?.draft);
  if (onboarding?.status !== 'complete' || !draft.success)
    return { status: 'incomplete' as const, safetyContext };

  const currentPlan = currentPlanRows[0];
  const completedLogs = logRows.filter((row) => row.completedAt !== null);
  const rpes = completedLogs.flatMap((row) =>
    row.rpe === null ? [] : [row.rpe],
  );
  const context = await buildWorkoutPlanningContext({
    planningDate: bangkokDate(now),
    timezone: 'Asia/Bangkok',
    onboarding: {
      recordId: onboarding.id,
      recordedAt: onboarding.updatedAt.toISOString(),
      draft: draft.data,
    },
    safetyContext,
    currentPlan: currentPlan
      ? {
          id: currentPlan.id,
          planVersion: currentPlan.planVersion,
          recordedAt: currentPlan.confirmedAt.toISOString(),
        }
      : null,
    recovery: {
      windowDays: 28,
      plannedSessions: completedLogs.length,
      completedSessions: completedLogs.length,
      stoppedForSafety: completedLogs.filter(
        (row) => row.status === 'stopped_for_safety',
      ).length,
      painReported: completedLogs.some((row) => row.pain),
      concerningSymptomsReported: completedLogs.some(
        (row) => row.concerningSymptoms,
      ),
      averageRpe:
        rpes.length === 0
          ? null
          : rpes.reduce((sum, rpe) => sum + rpe, 0) / rpes.length,
      dataCompleteness: completedLogs.length === 0 ? 'none' : 'partial',
      sources: completedLogs.map((row) => ({
        recordId: row.id,
        recordedAt: row.completedAt!.toISOString(),
      })),
    },
  });
  return { status: 'ready' as const, context, safetyContext };
}
