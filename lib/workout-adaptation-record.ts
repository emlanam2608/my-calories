import { workoutAdaptationProposalSchema } from './workout-adaptation-contracts';
import { workoutPlanV2Schema } from './workout-planning-contracts';
import type { workoutAdaptationProposals } from '@/db/schema';

export function serializeWorkoutAdaptationProposal(
  row: typeof workoutAdaptationProposals.$inferSelect,
) {
  return workoutAdaptationProposalSchema.parse({
    id: row.id,
    proposalVersion: row.proposalVersion,
    status: row.status,
    action: row.action,
    basePlanId: row.basePlanId,
    basePlanVersion: row.basePlanVersion,
    policyVersion: row.policyVersion,
    policyReviewStatus: row.policyReviewStatus,
    catalogVersion: row.catalogVersion,
    safetyContextVersion: row.safetyContextVersion,
    inputDigest: row.inputDigest,
    evidenceRecordIds: row.evidenceRecordIds,
    dataCompleteness: row.dataCompleteness,
    confidence: row.confidence,
    reasonCodes: row.reasonCodes,
    changes: row.changes,
    unresolvedQuestions: row.unresolvedQuestions,
    proposedPlan: row.proposedPlan ? workoutPlanV2Schema.parse(row.proposedPlan) : null,
    sourceCheckinId: row.sourceCheckinId,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    confirmedPlanId: row.confirmedPlanId,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    dismissedAt: row.dismissedAt?.toISOString() ?? null,
  });
}
