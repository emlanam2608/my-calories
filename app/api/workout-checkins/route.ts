import { and, desc, eq, inArray } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import {
  requestDeduplications,
  workoutAdaptationProposals,
  workoutCheckins,
  workoutPlans,
  workoutSessions,
} from '@/db/schema';
import { safetyReasonCodeSchema } from '@/lib/contracts';
import { resolveEffectiveSafetyContextForOwner } from '@/lib/effective-safety-context-server';
import {
  workoutEvidenceCheckinRequestSchema,
  workoutEvidenceCheckinSchema,
} from '@/lib/workout-evidence';
import { evaluateWorkoutCheckin } from '@/lib/workout-checkin';
import { parseStoredWorkoutPlan } from '@/lib/workout-plan-lifecycle';
import { resolveWorkoutAdaptation } from '@/lib/workout-adaptation-server';
import { WORKOUT_ADAPTATION_POLICY } from '@/lib/workout-adaptation-policy';
import { WORKOUT_ADAPTATION_PROPOSAL_VERSION } from '@/lib/workout-adaptation-contracts';
import { serializeWorkoutAdaptationProposal } from '@/lib/workout-adaptation-record';

function serializeCheckin(row: typeof workoutCheckins.$inferSelect) {
  const reasonCodes = Array.isArray(row.safetyReasonCodes)
    ? row.safetyReasonCodes.flatMap((code) => {
        const parsed = safetyReasonCodeSchema.safeParse(code);
        return parsed.success ? [parsed.data] : [];
      })
    : [];
  const hasRecovery = row.recoveryStatus !== 'not_recorded';
  return workoutEvidenceCheckinSchema.parse({
    id: row.id,
    planId: row.planId,
    action: row.action,
    plannedSessions: row.plannedSessions,
    completedSessions: row.completedSessions,
    safetyFlag: row.safetyFlag,
    safetyContextVersion: row.safetyContextVersion,
    safetyDecision: row.safetyDecision,
    safetyReasonCodes: reasonCodes,
    createdAt: row.createdAt.toISOString(),
    recovery: hasRecovery
      ? {
          status: row.recoveryStatus,
          soreness: row.sorenessFlag,
          pain: row.painFlag,
        }
      : null,
    dataCompleteness: hasRecovery
      ? 'structured_recovery'
      : 'legacy_no_recovery',
  });
}

async function checkinForOwner(ownerId: string, id?: string) {
  const conditions = [eq(workoutCheckins.ownerId, ownerId)];
  if (id) conditions.push(eq(workoutCheckins.id, id));
  const rows = await getDb()
    .select()
    .from(workoutCheckins)
    .where(and(...conditions))
    .orderBy(desc(workoutCheckins.createdAt))
    .limit(1);
  return rows[0] ? serializeCheckin(rows[0]) : null;
}

async function proposalForCheckin(ownerId: string, checkinId: string) {
  const rows = await getDb()
    .select()
    .from(workoutAdaptationProposals)
    .where(
      and(
        eq(workoutAdaptationProposals.ownerId, ownerId),
        eq(workoutAdaptationProposals.sourceCheckinId, checkinId),
      ),
    )
    .limit(1);
  return rows[0] ? serializeWorkoutAdaptationProposal(rows[0]) : null;
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  return Response.json(
    { checkin: await checkinForOwner(user.userId) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const parsed = workoutEvidenceCheckinRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      { error: 'Choose a valid workout plan and recovery status.' },
      { status: 400 },
    );
  const db = getDb();
  const existing = await db
    .select()
    .from(requestDeduplications)
    .where(
      and(
        eq(requestDeduplications.ownerId, user.userId),
        eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey),
      ),
    )
    .limit(1);
  if (existing[0]) {
    if (existing[0].resourceType !== 'workout_checkin')
      return Response.json(
        {
          error:
            'This idempotency key has already been used for a different request.',
        },
        { status: 409 },
      );
    return Response.json(
      {
        checkin: await checkinForOwner(user.userId, existing[0].resourceId),
        proposal: await proposalForCheckin(user.userId, existing[0].resourceId),
        replayed: true,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const planRows = await db
    .select()
    .from(workoutPlans)
    .where(
      and(
        eq(workoutPlans.id, parsed.data.planId),
        eq(workoutPlans.ownerId, user.userId),
        inArray(workoutPlans.status, ['active', 'confirmed']),
      ),
    )
    .limit(1);
  const plan = planRows[0] ? parseStoredWorkoutPlan(planRows[0].plan) : null;
  if (!plan)
    return Response.json(
      { error: 'The workout plan was not found.' },
      { status: 404 },
    );
  if (plan.planVersion === 'workout-plan-v2' && !parsed.data.recovery)
    return Response.json(
      { error: 'Record a bounded recovery status for this plan.' },
      { status: 400 },
    );
  const logs = await db
    .select({ sessionId: workoutSessions.sessionId })
    .from(workoutSessions)
    .where(
      and(
        eq(workoutSessions.ownerId, user.userId),
        eq(workoutSessions.planId, parsed.data.planId),
      ),
    );
  const completed = new Set(logs.map((log) => log.sessionId).filter(Boolean))
    .size;
  const safetyContext = await resolveEffectiveSafetyContextForOwner(
    user.userId,
  );
  const safetyDecision = safetyContext.decisions.workout_progression;
  const recoveryBlocks =
    parsed.data.recovery?.status === 'poor' ||
    parsed.data.recovery?.pain === true;
  const review = evaluateWorkoutCheckin({
    planned: plan.sessions.length,
    completed,
    safetyFlag: safetyDecision.status === 'blocked' || recoveryBlocks,
  });
  const now = new Date();
  const id = crypto.randomUUID();
  const adaptationPlan = plan.planVersion === 'workout-plan-v2' ? plan : null;
  const adaptation =
    adaptationPlan && parsed.data.recovery
      ? await resolveWorkoutAdaptation(
          user.userId,
          parsed.data.planId,
          adaptationPlan,
          {
            id,
            status: parsed.data.recovery.status,
            soreness: parsed.data.recovery.soreness ?? false,
            pain: parsed.data.recovery.pain ?? false,
          },
          now,
        )
      : null;
  const proposalId = adaptation ? crypto.randomUUID() : null;
  const expiresAt = new Date(now.getTime() + 7 * 86_400_000);
  try {
    await db.batch([
      db.insert(workoutCheckins).values({
        id,
        ownerId: user.userId,
        planId: parsed.data.planId,
        action: review.action,
        plannedSessions: review.planned,
        completedSessions: review.completed,
        safetyFlag: review.safetyFlag,
        safetyContextVersion: safetyContext.contextVersion,
        safetyDecision: safetyDecision.status,
        safetyReasonCodes: safetyDecision.reasons.map((reason) => reason.code),
        recoveryStatus: parsed.data.recovery?.status ?? 'not_recorded',
        sorenessFlag: parsed.data.recovery?.soreness ?? false,
        painFlag: parsed.data.recovery?.pain ?? false,
        createdAt: now,
      }),
      ...(adaptation && proposalId
        ? [
            db.insert(workoutAdaptationProposals).values({
              id: proposalId,
              ownerId: user.userId,
              proposalVersion: WORKOUT_ADAPTATION_PROPOSAL_VERSION,
              status: 'pending',
              action: adaptation.result.action,
              basePlanId: parsed.data.planId,
              basePlanVersion: plan.planVersion,
              policyVersion: WORKOUT_ADAPTATION_POLICY.version,
              policyReviewStatus: WORKOUT_ADAPTATION_POLICY.reviewStatus,
              catalogVersion: adaptationPlan!.catalogVersion,
              safetyContextVersion: adaptation.context.safety.contextVersion,
              inputDigest: adaptation.inputDigest,
              evidenceRecordIds: adaptation.result.evidenceRecordIds,
              dataCompleteness: adaptation.result.dataCompleteness,
              confidence: adaptation.result.confidence,
              reasonCodes: adaptation.result.reasonCodes,
              changes: adaptation.result.changes,
              unresolvedQuestions: adaptation.result.unresolvedQuestions,
              proposedPlan: adaptation.result.proposedPlan,
              sourceCheckinId: id,
              expiresAt,
              createdAt: now,
            }),
          ]
        : []),
      db.insert(requestDeduplications).values({
        id: crypto.randomUUID(),
        ownerId: user.userId,
        idempotencyKey: parsed.data.idempotencyKey,
        resourceType: 'workout_checkin',
        resourceId: id,
        createdAt: now,
      }),
    ]);
  } catch {
    const replay = await db
      .select()
      .from(requestDeduplications)
      .where(
        and(
          eq(requestDeduplications.ownerId, user.userId),
          eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey),
        ),
      )
      .limit(1);
    if (replay[0]?.resourceType === 'workout_checkin')
      return Response.json(
        {
          checkin: await checkinForOwner(user.userId, replay[0].resourceId),
          proposal: await proposalForCheckin(user.userId, replay[0].resourceId),
          replayed: true,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    if (replay[0])
      return Response.json(
        {
          error:
            'This idempotency key has already been used for a different request.',
        },
        { status: 409 },
      );
    return Response.json(
      { error: 'We could not save this workout check-in. Please try again.' },
      { status: 500 },
    );
  }
  return Response.json(
    {
      checkin: await checkinForOwner(user.userId, id),
      proposal: proposalId ? await proposalForCheckin(user.userId, id) : null,
      replayed: false,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
