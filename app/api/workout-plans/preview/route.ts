import { asc, eq } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { exerciseCatalog, profileOnboarding } from '@/db/schema';
import { exerciseCatalogEntrySchema } from '@/lib/exercise-catalog';
import { onboardingDraftSchema, workoutPlanResponseSchema } from '@/lib/contracts';
import { createStarterWorkoutPlan } from '@/lib/workout-plan';
import { resolveEffectiveSafetyContextForOwner } from '@/lib/effective-safety-context-server';
import { recommendationBlockedResponse } from '@/lib/safety-enforcement';

function bangkokDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export async function POST() {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const safetyContext = await resolveEffectiveSafetyContextForOwner(user.userId);
  if (safetyContext.decisions.workout_plan.status === 'blocked')
    return recommendationBlockedResponse(safetyContext, 'workout_plan');
  const onboarding = await getDb()
    .select({ draft: profileOnboarding.draft, status: profileOnboarding.status })
    .from(profileOnboarding)
    .where(eq(profileOnboarding.ownerId, user.userId))
    .limit(1);
  if (onboarding[0]?.status !== 'complete')
    return Response.json(
      { error: 'Complete your profile setup, including available days and equipment, before generating a plan.' },
      { status: 422 },
    );
  const onboardingDraft = onboardingDraftSchema.safeParse(onboarding[0].draft);
  if (!onboardingDraft.success || !onboardingDraft.data.equipment)
    return Response.json(
      { error: 'Review your saved equipment before generating a plan.' },
      { status: 422 },
    );
  const rows = await getDb()
    .select({
      id: exerciseCatalog.id,
      name: exerciseCatalog.name,
      category: exerciseCatalog.category,
      equipment: exerciseCatalog.equipment,
      muscleGroups: exerciseCatalog.muscleGroups,
      contraindicationTags: exerciseCatalog.contraindicationTags,
      technique: exerciseCatalog.technique,
      regression: exerciseCatalog.regression,
      progression: exerciseCatalog.progression,
      substitutionIds: exerciseCatalog.substitutionIds,
    })
    .from(exerciseCatalog)
    .where(eq(exerciseCatalog.catalogVersion, 'starter-1'))
    .orderBy(asc(exerciseCatalog.category), asc(exerciseCatalog.id));
  try {
    const plan = createStarterWorkoutPlan(
      rows.map((row) => exerciseCatalogEntrySchema.parse(row)),
      bangkokDate(),
      {
        equipment: onboardingDraft.data.equipment,
        clinicianRestrictionFlags:
          onboardingDraft.data.clinicianRestrictionFlags ?? [],
        injuryFlags: onboardingDraft.data.injuryFlags ?? [],
        availableDays: onboardingDraft.data.availableDays,
      },
    );
    return Response.json(
      workoutPlanResponseSchema.parse({
        id: null,
        status: 'preview',
        plan,
        confirmedAt: null,
      }),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json(
      { error: 'The starter exercise catalog is not ready. Please try again later.' },
      { status: 503 },
    );
  }
}
