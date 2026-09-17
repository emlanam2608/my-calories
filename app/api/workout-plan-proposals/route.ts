import { and, desc, eq, inArray } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { requestDeduplications, workoutAdaptationProposals, workoutCheckins, workoutPlans } from '@/db/schema';
import { serializeWorkoutAdaptationProposal } from '@/lib/workout-adaptation-record';
import { workoutProposalMutationRequestSchema } from '@/lib/workout-adaptation-contracts';
import { WORKOUT_ADAPTATION_POLICY } from '@/lib/workout-adaptation-policy';
import { resolveWorkoutAdaptation } from '@/lib/workout-adaptation-server';
import { activeWorkoutPlanSchema, parseStoredWorkoutPlan } from '@/lib/workout-plan-lifecycle';
import { workoutPlanningContextSchema, workoutPlanV2Schema } from '@/lib/workout-planning-contracts';

function staleResponse() {
  return Response.json({
    error: 'This workout proposal is no longer current. Run a new scheduled check-in.',
    code: 'workout_adaptation_proposal_stale',
  }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
}

async function proposalForOwner(ownerId: string, id?: string) {
  const conditions = [eq(workoutAdaptationProposals.ownerId, ownerId)];
  if (id) conditions.push(eq(workoutAdaptationProposals.id, id));
  const rows = await getDb().select().from(workoutAdaptationProposals).where(and(...conditions))
    .orderBy(desc(workoutAdaptationProposals.createdAt)).limit(1);
  return rows[0] ? serializeWorkoutAdaptationProposal(rows[0]) : null;
}

async function planForOwner(ownerId: string, id: string) {
  const rows = await getDb().select().from(workoutPlans).where(and(
    eq(workoutPlans.ownerId, ownerId), eq(workoutPlans.id, id),
  )).limit(1);
  const row = rows[0];
  if (!row) return null;
  const plan = parseStoredWorkoutPlan(row.plan);
  if (!plan) return null;
  return activeWorkoutPlanSchema.parse({
    id: row.id, status: row.status === 'superseded' ? 'superseded' : 'active', plan,
    planningContext: row.planningContext ? workoutPlanningContextSchema.parse(row.planningContext) : null,
    confirmedAt: row.confirmedAt.toISOString(), supersededAt: row.supersededAt?.toISOString() ?? null,
  });
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  return Response.json({ proposal: await proposalForOwner(user.userId) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const parsed = workoutProposalMutationRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Choose a valid proposal.' }, { status: 400 });
  const db = getDb();
  const existing = await db.select().from(requestDeduplications).where(and(
    eq(requestDeduplications.ownerId, user.userId),
    eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey),
  )).limit(1);
  if (existing[0]) {
    if (existing[0].resourceType !== 'workout_proposal_confirmation')
      return Response.json({ error: 'This idempotency key has already been used for a different request.' }, { status: 409 });
    return Response.json({ plan: await planForOwner(user.userId, existing[0].resourceId), proposal: await proposalForOwner(user.userId, parsed.data.proposalId), replayed: true }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const rows = await db.select().from(workoutAdaptationProposals).where(and(
    eq(workoutAdaptationProposals.ownerId, user.userId),
    eq(workoutAdaptationProposals.id, parsed.data.proposalId),
  )).limit(1);
  const proposal = rows[0];
  if (!proposal) return Response.json({ error: 'Workout proposal not found.' }, { status: 404 });
  const now = new Date();
  if (proposal.status !== 'pending' || proposal.expiresAt <= now) {
    if (proposal.status === 'pending') await db.update(workoutAdaptationProposals).set({ status: 'expired' }).where(eq(workoutAdaptationProposals.id, proposal.id));
    return staleResponse();
  }
  const baseRows = await db.select().from(workoutPlans).where(and(
    eq(workoutPlans.id, proposal.basePlanId), eq(workoutPlans.ownerId, user.userId),
    inArray(workoutPlans.status, ['active', 'confirmed']),
  )).limit(1);
  const basePlan = baseRows[0] ? workoutPlanV2Schema.safeParse(baseRows[0].plan) : null;
  if (!basePlan?.success) return staleResponse();
  const checkins = await db.select().from(workoutCheckins).where(and(
    eq(workoutCheckins.id, proposal.sourceCheckinId), eq(workoutCheckins.ownerId, user.userId),
  )).limit(1);
  const checkin = checkins[0];
  if (!checkin || checkin.recoveryStatus === 'not_recorded') return staleResponse();
  let verification;
  try {
    verification = await resolveWorkoutAdaptation(user.userId, proposal.basePlanId, basePlan.data, {
      id: checkin.id,
      status: checkin.recoveryStatus as 'good' | 'some_fatigue' | 'poor',
      soreness: checkin.sorenessFlag,
      pain: checkin.painFlag,
    }, now);
  } catch {
    return staleResponse();
  }
  const storedPlan = proposal.proposedPlan ? workoutPlanV2Schema.safeParse(proposal.proposedPlan) : null;
  const proposedPlanMatches = proposal.action === 'hold_for_review'
    ? proposal.proposedPlan === null && verification.result.proposedPlan === null
    : storedPlan?.success === true && JSON.stringify(verification.result.proposedPlan) === JSON.stringify(storedPlan.data);
  if (
    verification.inputDigest !== proposal.inputDigest ||
    verification.result.action !== proposal.action ||
    verification.context.currentPlan?.id !== proposal.basePlanId ||
    proposal.catalogVersion !== basePlan.data.catalogVersion ||
    proposal.policyVersion !== WORKOUT_ADAPTATION_POLICY.version ||
    proposal.policyReviewStatus !== WORKOUT_ADAPTATION_POLICY.reviewStatus ||
    proposal.safetyContextVersion !== verification.context.safety.contextVersion ||
    !proposedPlanMatches
  ) return staleResponse();
  if (proposal.action === 'hold_for_review')
    return Response.json({ error: 'A safety hold cannot be applied as a new plan.' }, { status: 422 });
  if (!storedPlan?.success) return staleResponse();
  const planId = crypto.randomUUID();
  try {
    await db.batch([
      db.update(workoutPlans).set({ status: 'superseded', supersededAt: now }).where(and(
        eq(workoutPlans.id, proposal.basePlanId), eq(workoutPlans.ownerId, user.userId),
        inArray(workoutPlans.status, ['active', 'confirmed']),
      )),
      db.insert(workoutPlans).values({
        id: planId, ownerId: user.userId, planVersion: storedPlan.data.planVersion,
        periodStart: storedPlan.data.periodStart, status: 'active', plan: storedPlan.data,
        planningContext: verification.context, planningContextDigest: verification.context.inputDigest,
        catalogVersion: storedPlan.data.catalogVersion, sourceProposalId: proposal.id,
        createdAt: now, confirmedAt: now,
      }),
      db.update(workoutAdaptationProposals).set({ status: 'confirmed', confirmedPlanId: planId, confirmedAt: now }).where(and(
        eq(workoutAdaptationProposals.id, proposal.id), eq(workoutAdaptationProposals.status, 'pending'),
      )),
      db.insert(requestDeduplications).values({
        id: crypto.randomUUID(), ownerId: user.userId,
        idempotencyKey: parsed.data.idempotencyKey,
        resourceType: 'workout_proposal_confirmation', resourceId: planId, createdAt: now,
      }),
    ]);
  } catch {
    const replay = await db.select().from(requestDeduplications).where(and(
      eq(requestDeduplications.ownerId, user.userId), eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey),
    )).limit(1);
    if (replay[0]?.resourceType === 'workout_proposal_confirmation')
      return Response.json({ plan: await planForOwner(user.userId, replay[0].resourceId), proposal: await proposalForOwner(user.userId, proposal.id), replayed: true }, { headers: { 'Cache-Control': 'no-store' } });
    return staleResponse();
  }
  return Response.json({ plan: await planForOwner(user.userId, planId), proposal: await proposalForOwner(user.userId, proposal.id), replayed: false }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const parsed = workoutProposalMutationRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Choose a valid proposal.' }, { status: 400 });
  const db = getDb();
  const existing = await db.select().from(requestDeduplications).where(and(
    eq(requestDeduplications.ownerId, user.userId), eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey),
  )).limit(1);
  if (existing[0]) {
    if (existing[0].resourceType !== 'workout_proposal_dismissal')
      return Response.json({ error: 'This idempotency key has already been used for a different request.' }, { status: 409 });
    return Response.json({ proposal: await proposalForOwner(user.userId, existing[0].resourceId), replayed: true }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const target = await db.select({ status: workoutAdaptationProposals.status }).from(workoutAdaptationProposals).where(and(
    eq(workoutAdaptationProposals.id, parsed.data.proposalId),
    eq(workoutAdaptationProposals.ownerId, user.userId),
  )).limit(1);
  if (!target[0]) return Response.json({ error: 'Workout proposal not found.' }, { status: 404 });
  if (target[0].status !== 'pending') return staleResponse();
  const now = new Date();
  try {
    await db.batch([
      db.update(workoutAdaptationProposals).set({ status: 'dismissed', dismissedAt: now }).where(and(
        eq(workoutAdaptationProposals.id, parsed.data.proposalId),
        eq(workoutAdaptationProposals.ownerId, user.userId),
        eq(workoutAdaptationProposals.status, 'pending'),
      )),
      db.insert(requestDeduplications).values({
        id: crypto.randomUUID(), ownerId: user.userId,
        idempotencyKey: parsed.data.idempotencyKey,
        resourceType: 'workout_proposal_dismissal', resourceId: parsed.data.proposalId, createdAt: now,
      }),
    ]);
  } catch {
    return staleResponse();
  }
  const proposal = await proposalForOwner(user.userId, parsed.data.proposalId);
  if (!proposal || proposal.status !== 'dismissed') return staleResponse();
  return Response.json({ proposal, replayed: false }, { headers: { 'Cache-Control': 'no-store' } });
}
