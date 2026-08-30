export const workoutReadinessFlagKeys = [
  'chestPain',
  'faintingOrDizziness',
  'severeShortnessOfBreath',
  'irregularHeartbeat',
  'clinicianRestriction',
  'exerciseGlucoseRisk',
] as const;

export type WorkoutReadinessFlag = (typeof workoutReadinessFlagKeys)[number];
export type WorkoutReadinessStatus = 'cleared' | 'needs_review';

export type WorkoutReadinessAnswers = Record<WorkoutReadinessFlag, boolean>;

export function evaluateWorkoutReadiness(answers: WorkoutReadinessAnswers) {
  const flags = workoutReadinessFlagKeys.filter((flag) => answers[flag]);
  return {
    flags,
    status: (flags.length ? 'needs_review' : 'cleared') as WorkoutReadinessStatus,
  };
}
