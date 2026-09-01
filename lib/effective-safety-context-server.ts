import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { profileOnboarding, workoutReadiness, workoutSessions } from '@/db/schema';
import { onboardingDraftSchema } from './contracts';
import { resolveEffectiveSafetyContext } from './effective-safety-context';
import { evaluateWorkoutReadiness } from './workout-readiness';

export async function resolveEffectiveSafetyContextForOwner(
  ownerId: string,
  now = new Date(),
) {
  const db = getDb();
  const [onboardingRows, readinessRows, logRows] = await Promise.all([
    db.select({
      id: profileOnboarding.id,
      draft: profileOnboarding.draft,
      updatedAt: profileOnboarding.updatedAt,
    }).from(profileOnboarding).where(eq(profileOnboarding.ownerId, ownerId)).limit(1),
    db.select().from(workoutReadiness).where(eq(workoutReadiness.ownerId, ownerId)).limit(1),
    db.select({
      id: workoutSessions.id,
      completedAt: workoutSessions.completedAt,
      pain: workoutSessions.pain,
      concerningSymptoms: workoutSessions.concerningSymptoms,
      preGlucoseScaled: workoutSessions.preGlucoseScaled,
      postGlucoseScaled: workoutSessions.postGlucoseScaled,
      glucoseScale: workoutSessions.glucoseScale,
    }).from(workoutSessions).where(eq(workoutSessions.ownerId, ownerId)).orderBy(desc(workoutSessions.completedAt)).limit(20),
  ]);

  const onboardingRow = onboardingRows[0];
  const onboardingDraft = onboardingRow
    ? onboardingDraftSchema.safeParse(onboardingRow.draft)
    : null;
  const readinessRow = readinessRows[0];
  const evaluatedReadiness = readinessRow
    ? evaluateWorkoutReadiness({
        chestPain: readinessRow.chestPain,
        faintingOrDizziness: readinessRow.faintingOrDizziness,
        severeShortnessOfBreath: readinessRow.severeShortnessOfBreath,
        irregularHeartbeat: readinessRow.irregularHeartbeat,
        clinicianRestriction: readinessRow.clinicianRestriction,
        exerciseGlucoseRisk: readinessRow.exerciseGlucoseRisk,
      })
    : null;

  return resolveEffectiveSafetyContext({
    now,
    onboarding: onboardingRow && onboardingDraft?.success
      ? { id: onboardingRow.id, updatedAt: onboardingRow.updatedAt, draft: onboardingDraft.data }
      : undefined,
    readiness: readinessRow && evaluatedReadiness
      ? {
          id: readinessRow.id,
          status: evaluatedReadiness.status,
          flags: evaluatedReadiness.flags,
          confirmedAt: readinessRow.confirmedAt,
        }
      : undefined,
    workoutLogs: logRows.map((row) => ({
      id: row.id,
      completedAt: row.completedAt,
      pain: row.pain,
      concerningSymptoms: row.concerningSymptoms,
      preGlucose: row.preGlucoseScaled === null || row.glucoseScale <= 0
        ? null
        : row.preGlucoseScaled / row.glucoseScale,
      postGlucose: row.postGlucoseScaled === null || row.glucoseScale <= 0
        ? null
        : row.postGlucoseScaled / row.glucoseScale,
    })),
  });
}
