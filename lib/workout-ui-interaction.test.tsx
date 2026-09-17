// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkoutPlanWorkspace } from '@/components/dashboard/workout-plan-workspace';
import { WorkoutReadinessSurface } from '@/components/dashboard/workout-readiness-surface';
import { getCopy } from './copy';
import { activeWorkoutPlanSchema } from './workout-plan-lifecycle';
import { workoutPlanV2Schema } from './workout-planning-contracts';

const plan = workoutPlanV2Schema.parse({
  planVersion: 'workout-plan-v2',
  plannerVersion: 'deterministic-weekly-planner-1',
  catalogVersion: 'starter-2',
  catalogReviewStatus: 'unreviewed',
  policy: {
    version: 'conservative-prescription-policy-1',
    reviewStatus: 'unreviewed',
    reviewedVersion: null,
    reviewedAt: null,
    reviewReference: null,
  },
  safetyContextVersion: 'effective-safety-context-1',
  inputDigest: 'a'.repeat(64),
  periodStart: '2026-09-06',
  timezone: 'Asia/Bangkok',
  draftStatus: 'complete',
  appliedSafetyReasonCodes: [],
  unresolvedQuestions: [],
  sessions: [
    {
      id: 'v2-2026-09-07-strength-1',
      day: 'mon',
      date: '2026-09-07',
      purpose: 'strength',
      titleCopyKey: 'workoutPlanner.title.strength',
      rationaleCopyKeys: ['workoutPlanner.reason.strength'],
      durationMinutes: 20,
      targetRpe: 4,
      progressionCriteriaCopyKeys: ['workoutPlanner.progression.recover'],
      sections: [
        {
          phase: 'warmup',
          prescriptions: [
            {
              exerciseId: 'warm',
              allocatedMinutes: 3,
              sets: null,
              reps: null,
              durationMinutes: 3,
              restSeconds: null,
              targetRpe: 2,
              rationaleCopyKey: 'workoutPlanner.reason.warm',
              substitutionIds: [],
              modificationReasonCodes: [],
            },
          ],
        },
        {
          phase: 'strength',
          prescriptions: [
            {
              exerciseId: 'row',
              allocatedMinutes: 10,
              sets: 2,
              reps: 8,
              durationMinutes: null,
              restSeconds: 60,
              targetRpe: 4,
              rationaleCopyKey: 'workoutPlanner.reason.row',
              substitutionIds: [],
              modificationReasonCodes: [],
            },
          ],
        },
        {
          phase: 'cooldown',
          prescriptions: [
            {
              exerciseId: 'cool',
              allocatedMinutes: 3,
              sets: null,
              reps: null,
              durationMinutes: 3,
              restSeconds: null,
              targetRpe: 2,
              rationaleCopyKey: 'workoutPlanner.reason.cool',
              substitutionIds: [],
              modificationReasonCodes: [],
            },
          ],
        },
      ],
    },
  ],
});

const activePlan = activeWorkoutPlanSchema.parse({
  id: '018e2aaa-6a86-4d9d-b36a-a3d96fd00e01',
  status: 'active',
  plan,
  planningContext: null,
  confirmedAt: '2026-09-07T08:00:00+07:00',
  supersededAt: null,
});

const callbacks = {
  onConfirmPlan: vi.fn(async () => {}),
  onSaveLog: vi.fn(async () => {}),
  onRunCheckin: vi.fn(async () => {}),
  onConfirmProposal: vi.fn(async () => {}),
  onDismissProposal: vi.fn(async () => {}),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('P2.6 workout workspace interactions', () => {
  it('keeps every sensitive mutation disabled while offline', () => {
    const c = getCopy('en').workouts;
    render(
      <WorkoutPlanWorkspace
        exercises={[]}
        confirmedPlan={activePlan}
        logs={[]}
        checkin={null}
        proposal={null}
        online={false}
        locale="en"
        onPreview={async () => ({
          previewId: '018e2aaa-6a86-4d9d-b36a-a3d96fd00e02',
          status: 'preview',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          plan,
        })}
        {...callbacks}
      />,
    );
    for (const name of [c.replacePlan, c.saveLog, c.createProposal])
      expect(screen.getByRole('button', { name })).toHaveProperty(
        'disabled',
        true,
      );
  });

  it('supports keyboard preview and disables confirmation when the preview expires', async () => {
    const c = getCopy('en').workouts;
    const onPreview = vi.fn(async () => ({
      previewId: '018e2aaa-6a86-4d9d-b36a-a3d96fd00e03',
      status: 'preview' as const,
      expiresAt: new Date(Date.now() + 30).toISOString(),
      plan,
    }));
    const user = userEvent.setup();
    render(
      <WorkoutPlanWorkspace
        exercises={[]}
        confirmedPlan={null}
        logs={[]}
        checkin={null}
        proposal={null}
        online
        locale="en"
        onPreview={onPreview}
        {...callbacks}
      />,
    );
    screen.getByRole('button', { name: c.previewPlan }).focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(onPreview).toHaveBeenCalledOnce());
    await screen.findByText(c.previewExpired);
    expect(screen.getByRole('button', { name: c.confirmPlan })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('resets logging and recovery drafts when a replacement plan becomes active', async () => {
    const c = getCopy('en').workouts;
    const user = userEvent.setup();
    const view = render(
      <WorkoutPlanWorkspace
        exercises={[]}
        confirmedPlan={activePlan}
        logs={[]}
        checkin={null}
        proposal={null}
        online
        locale="en"
        onPreview={async () => {
          throw new Error('not called');
        }}
        {...callbacks}
      />,
    );
    const glucose = screen.getByLabelText(c.preGlucose) as HTMLInputElement;
    await user.type(glucose, '7.3');
    await user.click(screen.getByLabelText(c.recoveryPoor));
    expect(glucose.value).toBe('7.3');
    expect(screen.getByLabelText(c.recoveryPoor)).toHaveProperty(
      'checked',
      true,
    );

    view.rerender(
      <WorkoutPlanWorkspace
        exercises={[]}
        confirmedPlan={{
          ...activePlan,
          id: '018e2aaa-6a86-4d9d-b36a-a3d96fd00e04',
        }}
        logs={[]}
        checkin={null}
        proposal={null}
        online
        locale="en"
        onPreview={async () => {
          throw new Error('not called');
        }}
        {...callbacks}
      />,
    );
    expect(screen.getByLabelText(c.preGlucose)).toHaveProperty('value', '');
    expect(screen.getByLabelText(c.recoveryGood)).toHaveProperty(
      'checked',
      true,
    );
  });

  it('does not mount workout controls for a safety-blocked readiness result', () => {
    const c = getCopy('en').workouts;
    render(
      <WorkoutReadinessSurface
        readiness={{
          status: 'needs_review',
          flags: ['chestPain'],
          confirmedAt: '2026-09-07T08:00:00+07:00',
        }}
        safetyContext={null}
        exercises={[]}
        confirmedPlan={activePlan}
        logs={[]}
        checkin={null}
        proposal={null}
        online
        locale="en"
        onSave={async () => {}}
        onPreview={async () => {
          throw new Error('not called');
        }}
        {...callbacks}
      />,
    );
    expect(screen.getByText(c.pausedTitle)).toBeTruthy();
    expect(screen.queryByRole('button', { name: c.replacePlan })).toBeNull();
  });
});
