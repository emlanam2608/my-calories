export type CheckinAction = 'hold_for_review' | 'repeat' | 'maintain';

export function evaluateWorkoutCheckin({ planned, completed, safetyFlag }: { planned: number; completed: number; safetyFlag: boolean }) {
  const action: CheckinAction = safetyFlag
    ? 'hold_for_review'
    : completed < Math.ceil(planned / 2)
      ? 'repeat'
      : 'maintain';
  return { planned, completed, safetyFlag, action };
}
