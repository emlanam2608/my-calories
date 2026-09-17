import { z } from 'zod';
import { exerciseReviewStatusSchema } from './exercise-catalog';
import { workoutPlanV2PrescriptionSchema, workoutPlanV2Schema } from './workout-planning-contracts';

export const WORKOUT_ADAPTATION_PROPOSAL_VERSION = 'workout-adaptation-proposal-1' as const;
export const workoutAdaptationActionSchema = z.enum(['hold_for_review', 'maintain', 'progress', 'deload', 'substitute']);
export const workoutAdaptationReasonSchema = z.enum([
  'safety_blocked', 'concerning_workout_evidence', 'recovery_pain',
  'exercise_incompatible', 'substitution_unresolved', 'poor_recovery',
  'some_fatigue', 'excess_effort', 'insufficient_evidence',
  'duplicate_session_evidence', 'legacy_evidence', 'progression_policy_unreviewed',
  'progression_criteria_met', 'maintenance_appropriate',
]);

export const workoutPrescriptionChangeSchema = z.object({
  sessionId: z.string().trim().min(1).max(80),
  exerciseId: z.string().trim().min(1).max(80),
  before: workoutPlanV2PrescriptionSchema,
  after: workoutPlanV2PrescriptionSchema.nullable(),
  reasonCode: workoutAdaptationReasonSchema,
}).strict();

export const workoutAdaptationProposalSchema = z.object({
  id: z.string().uuid(),
  proposalVersion: z.literal(WORKOUT_ADAPTATION_PROPOSAL_VERSION),
  status: z.enum(['pending', 'confirmed', 'dismissed', 'expired']),
  action: workoutAdaptationActionSchema,
  basePlanId: z.string().uuid(),
  basePlanVersion: z.string().trim().min(1).max(80),
  policyVersion: z.string().trim().min(1).max(80),
  policyReviewStatus: exerciseReviewStatusSchema,
  catalogVersion: z.string().trim().min(1).max(80),
  safetyContextVersion: z.string().trim().min(1).max(80),
  inputDigest: z.string().regex(/^[a-f0-9]{64}$/),
  evidenceRecordIds: z.array(z.string().trim().min(1).max(100)).max(1_000),
  dataCompleteness: z.enum(['insufficient', 'partial', 'complete']),
  confidence: z.enum(['low', 'moderate', 'high']),
  reasonCodes: z.array(workoutAdaptationReasonSchema).min(1).max(20),
  changes: z.array(workoutPrescriptionChangeSchema).max(160),
  unresolvedQuestions: z.array(z.object({
    code: z.enum(['professional_review_required', 'eligible_substitution_required', 'more_exercise_evidence_required']),
    exerciseIds: z.array(z.string().trim().min(1).max(80)).max(160),
  }).strict()).max(20),
  proposedPlan: workoutPlanV2Schema.nullable(),
  sourceCheckinId: z.string().uuid(),
  expiresAt: z.string().datetime({ offset: true }),
  createdAt: z.string().datetime({ offset: true }),
  confirmedPlanId: z.string().uuid().nullable(),
  confirmedAt: z.string().datetime({ offset: true }).nullable(),
  dismissedAt: z.string().datetime({ offset: true }).nullable(),
}).strict();

export const workoutProposalMutationRequestSchema = z.object({
  idempotencyKey: z.string().uuid(),
  proposalId: z.string().uuid(),
}).strict();

export type WorkoutAdaptationProposal = z.infer<typeof workoutAdaptationProposalSchema>;
export type WorkoutAdaptationReason = z.infer<typeof workoutAdaptationReasonSchema>;
