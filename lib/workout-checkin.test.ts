import { describe, expect, it } from 'vitest';
import { evaluateWorkoutCheckin } from './workout-checkin';

describe('workout check-in', () => {
  it('holds a plan for review when a safety flag was logged', () => {
    expect(evaluateWorkoutCheckin({ planned: 3, completed: 3, safetyFlag: true }).action).toBe('hold_for_review');
  });
  it('repeats a low-adherence plan instead of progressing it', () => {
    expect(evaluateWorkoutCheckin({ planned: 3, completed: 1, safetyFlag: false }).action).toBe('repeat');
  });
});
