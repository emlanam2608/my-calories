import { and, asc, desc, eq } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { exerciseCatalog, profileOnboarding, requestDeduplications, workoutPlans, workoutReadiness } from '@/db/schema';
import {
  confirmWorkoutPlanRequestSchema,
  onboardingDraftSchema,
  workoutPlanResponseSchema,
} from '@/lib/contracts';
import { exerciseCatalogEntrySchema } from '@/lib/exercise-catalog';
import { selectableWorkoutExercises } from '@/lib/workout-plan';

async function currentPlanForOwner(ownerId: string) {
  const row = await getDb()
    .select()
    .from(workoutPlans)
    .where(eq(workoutPlans.ownerId, ownerId))
    .orderBy(desc(workoutPlans.createdAt))
    .limit(1);
  if (!row[0]) return null;
  return workoutPlanResponseSchema.parse({
    id: row[0].id,
    status: 'confirmed',
    plan: row[0].plan,
    confirmedAt: row[0].confirmedAt.toISOString(),
  });
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  return Response.json({ plan: await currentPlanForOwner(user.userId) }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const parsed = confirmWorkoutPlanRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json({ error: 'Review a valid plan before confirming it.' }, { status: 400 });
  const readiness = await getDb()
    .select({ status: workoutReadiness.status })
    .from(workoutReadiness)
    .where(eq(workoutReadiness.ownerId, user.userId))
    .limit(1);
  if (readiness[0]?.status !== 'cleared')
    return Response.json(
      { error: 'Workout plan confirmation is paused by your readiness screen.' },
      { status: 422 },
    );
  const onboarding = await getDb()
    .select({ status: profileOnboarding.status, draft: profileOnboarding.draft })
    .from(profileOnboarding)
    .where(eq(profileOnboarding.ownerId, user.userId))
    .limit(1);
  const onboardingRecord = onboarding[0];
  if (onboardingRecord?.status !== 'complete')
    return Response.json(
      { error: 'Workout plan confirmation requires completed profile planning basics.' },
      { status: 422 },
    );
  const onboardingDraft = onboardingDraftSchema.safeParse(onboardingRecord.draft);
  if (!onboardingDraft.success || !onboardingDraft.data.equipment)
    return Response.json(
      { error: 'Review your saved equipment before confirming a plan.' },
      { status: 422 },
    );
  if (
    onboardingDraft.data.symptomFlags?.some((flag) =>
      ['chest_discomfort', 'dizziness', 'shortness_of_breath'].includes(flag),
    )
  )
    return Response.json(
      { error: 'Workout plan confirmation is paused because you reported a concerning symptom. Review this with an appropriate clinician first.' },
      { status: 422 },
    );
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const planStart = new Date(`${parsed.data.plan.periodStart}T00:00:00.000Z`);
  const usesUnavailableDay = parsed.data.plan.sessions.some((session) => {
    const date = new Date(planStart);
    date.setUTCDate(date.getUTCDate() + session.dayOffset);
    return !onboardingDraft.data.availableDays?.includes(dayNames[date.getUTCDay()] as 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat');
  });
  if (usesUnavailableDay)
    return Response.json(
      { error: 'This plan no longer matches your saved available training days. Generate a new preview before confirming.' },
      { status: 422 },
    );
  const catalogRows = await getDb()
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
  const permittedExerciseIds = new Set(
    selectableWorkoutExercises(
      catalogRows.map((row) => exerciseCatalogEntrySchema.parse(row)),
      {
        equipment: onboardingDraft.data.equipment,
        clinicianRestrictionFlags:
          onboardingDraft.data.clinicianRestrictionFlags ?? [],
        injuryFlags: onboardingDraft.data.injuryFlags ?? [],
      },
    ).map((exercise) => exercise.id),
  );
  if (
    parsed.data.plan.sessions
      .flatMap((session) => session.exerciseIds)
      .some((exerciseId) => !permittedExerciseIds.has(exerciseId))
  )
    return Response.json(
      { error: 'This plan no longer matches your saved equipment or clinician exercise restrictions. Generate a new preview before confirming.' },
      { status: 422 },
    );

  const db = getDb();
  const existing = await db
    .select({ resourceType: requestDeduplications.resourceType })
    .from(requestDeduplications)
    .where(
      and(
        eq(requestDeduplications.ownerId, user.userId),
        eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey),
      ),
    )
    .limit(1);
  if (existing[0]) {
    if (existing[0].resourceType !== 'workout_plan')
      return Response.json(
        { error: 'This idempotency key has already been used for a different request.' },
        { status: 409 },
      );
    return Response.json(
      { plan: await currentPlanForOwner(user.userId), replayed: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const now = new Date();
  const id = crypto.randomUUID();
  try {
    await db.batch([
      db.insert(workoutPlans).values({
        id,
        ownerId: user.userId,
        planVersion: parsed.data.plan.planVersion,
        periodStart: parsed.data.plan.periodStart,
        status: 'confirmed',
        plan: parsed.data.plan,
        createdAt: now,
        confirmedAt: now,
      }),
      db.insert(requestDeduplications).values({
        id: crypto.randomUUID(),
        ownerId: user.userId,
        idempotencyKey: parsed.data.idempotencyKey,
        resourceType: 'workout_plan',
        resourceId: id,
        createdAt: now,
      }),
    ]);
  } catch {
    return Response.json(
      { error: 'We could not confirm this workout plan. Please try again.' },
      { status: 500 },
    );
  }
  return Response.json(
    {
      plan: workoutPlanResponseSchema.parse({
        id,
        status: 'confirmed',
        plan: parsed.data.plan,
        confirmedAt: now.toISOString(),
      }),
      replayed: false,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
