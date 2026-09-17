export const WORKOUT_ADAPTATION_POLICY = {
  version: 'conservative-adaptation-policy-1',
  reviewStatus: 'unreviewed' as const,
  reviewedVersion: null,
  reviewedAt: null,
  reviewReference: null,
  minimumCompleteSessions: 2,
  minimumAdherenceRatio: 0.8,
  excessRpeDelta: 2,
  progressionMaximumRpeDelta: 0,
  progressionRepIncrease: 1,
  progressionDurationIncreaseMinutes: 2,
  maximumReps: 30,
  maximumDurationMinutes: 60,
  deloadPercent: 20,
  minimumSets: 1,
  minimumReps: 1,
  minimumDurationMinutes: 1,
  targetRpeReduction: 1,
} as const;

export type WorkoutAdaptationPolicy = {
  version: string;
  reviewStatus: 'unreviewed' | 'professionally_reviewed';
  reviewedVersion: string | null;
  reviewedAt: string | null;
  reviewReference: string | null;
  minimumCompleteSessions: number;
  minimumAdherenceRatio: number;
  excessRpeDelta: number;
  progressionMaximumRpeDelta: number;
  progressionRepIncrease: number;
  progressionDurationIncreaseMinutes: number;
  maximumReps: number;
  maximumDurationMinutes: number;
  deloadPercent: number;
  minimumSets: number;
  minimumReps: number;
  minimumDurationMinutes: number;
  targetRpeReduction: number;
};
