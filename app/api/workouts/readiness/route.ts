import { and, eq } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { requestDeduplications, workoutReadiness } from '@/db/schema';
import {
  workoutReadinessRequestSchema,
  workoutReadinessResponseSchema,
} from '@/lib/contracts';
import { evaluateWorkoutReadiness } from '@/lib/workout-readiness';

async function readinessForOwner(ownerId: string) {
  const row = await getDb()
    .select()
    .from(workoutReadiness)
    .where(eq(workoutReadiness.ownerId, ownerId))
    .limit(1);
  if (!row[0])
    return workoutReadinessResponseSchema.parse({
      status: 'not_completed',
      flags: [],
      confirmedAt: null,
    });
  const { flags, status } = evaluateWorkoutReadiness({
    chestPain: row[0].chestPain,
    faintingOrDizziness: row[0].faintingOrDizziness,
    severeShortnessOfBreath: row[0].severeShortnessOfBreath,
    irregularHeartbeat: row[0].irregularHeartbeat,
    clinicianRestriction: row[0].clinicianRestriction,
    exerciseGlucoseRisk: row[0].exerciseGlucoseRisk,
  });
  return workoutReadinessResponseSchema.parse({
    status,
    flags,
    confirmedAt: row[0].confirmedAt.toISOString(),
  });
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  return Response.json(await readinessForOwner(user.userId), {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const parsed = workoutReadinessRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json({ error: 'Complete every readiness answer.' }, { status: 400 });

  const db = getDb();
  const existing = await db
    .select({
      resourceId: requestDeduplications.resourceId,
      resourceType: requestDeduplications.resourceType,
    })
    .from(requestDeduplications)
    .where(
      and(
        eq(requestDeduplications.ownerId, user.userId),
        eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey),
      ),
    )
    .limit(1);
  if (existing[0]) {
    if (existing[0].resourceType !== 'workout_readiness')
      return Response.json(
        { error: 'This idempotency key has already been used for a different request.' },
        { status: 409 },
      );
    return Response.json(
      { ...(await readinessForOwner(user.userId)), replayed: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const { flags, status } = evaluateWorkoutReadiness(parsed.data);
  const now = new Date();
  try {
    await db.batch([
      db.delete(workoutReadiness).where(eq(workoutReadiness.ownerId, user.userId)),
      db.insert(workoutReadiness).values({
        id: crypto.randomUUID(),
        ownerId: user.userId,
        chestPain: parsed.data.chestPain,
        faintingOrDizziness: parsed.data.faintingOrDizziness,
        severeShortnessOfBreath: parsed.data.severeShortnessOfBreath,
        irregularHeartbeat: parsed.data.irregularHeartbeat,
        clinicianRestriction: parsed.data.clinicianRestriction,
        exerciseGlucoseRisk: parsed.data.exerciseGlucoseRisk,
        status,
        confirmedAt: now,
        updatedAt: now,
      }),
      db.insert(requestDeduplications).values({
        id: crypto.randomUUID(),
        ownerId: user.userId,
        idempotencyKey: parsed.data.idempotencyKey,
        resourceType: 'workout_readiness',
        resourceId: 'current',
        createdAt: now,
      }),
    ]);
  } catch {
    const replay = await db
      .select({ resourceType: requestDeduplications.resourceType })
      .from(requestDeduplications)
      .where(
        and(
          eq(requestDeduplications.ownerId, user.userId),
          eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey),
        ),
      )
      .limit(1);
    if (replay[0]?.resourceType === 'workout_readiness')
      return Response.json(
        { ...(await readinessForOwner(user.userId)), replayed: true },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    return Response.json(
      { error: 'We could not save workout readiness. Please try again.' },
      { status: 500 },
    );
  }

  return Response.json(
    {
      status,
      flags,
      confirmedAt: now.toISOString(),
      replayed: false,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
