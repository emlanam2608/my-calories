import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  WorkoutPlanWorkspace,
  workoutPreviewExpiryDelay,
} from '@/components/dashboard/workout-plan-workspace';
import { WorkoutReadinessSurface } from '@/components/dashboard/workout-readiness-surface';
import { activeWorkoutPlanSchema } from './workout-plan-lifecycle';
import { workoutPlanV2Schema } from './workout-planning-contracts';
import { getCopy } from './copy';

const root = new URL('../', import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), 'utf8');

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
  onPreview: async () => {
    throw new Error('not called during server rendering');
  },
  onConfirmPlan: async () => {},
  onSaveLog: async () => {},
  onRunCheckin: async () => {},
  onConfirmProposal: async () => {},
  onDismissProposal: async () => {},
};

describe('P2.6 workout workspace UI contract', () => {
  it('renders empty and offline active-plan states from the real workspace component', () => {
    const c = getCopy('en').workouts;
    const empty = renderToStaticMarkup(
      createElement(WorkoutPlanWorkspace, {
        exercises: [],
        confirmedPlan: null,
        logs: [],
        checkin: null,
        proposal: null,
        online: true,
        locale: 'en',
        ...callbacks,
      }),
    );
    expect(empty).toContain(c.workspaceTitle);
    expect(empty).toContain(c.noActivePlan);

    const offline = renderToStaticMarkup(
      createElement(WorkoutPlanWorkspace, {
        exercises: [],
        confirmedPlan: activePlan,
        logs: [],
        checkin: null,
        proposal: null,
        online: false,
        locale: 'en',
        ...callbacks,
      }),
    );
    expect(offline).toContain(c.offlineTitle);
    expect(offline).toContain(c.recoveryTitle);
    expect(offline).toContain('<fieldset>');
    expect(offline).toContain('disabled=""');
  });

  it('renders a safety-blocked readiness state without exposing the plan workspace', () => {
    const c = getCopy('en').workouts;
    const html = renderToStaticMarkup(
      createElement(WorkoutReadinessSurface, {
        readiness: {
          status: 'needs_review',
          flags: ['chestPain'],
          confirmedAt: '2026-09-07T08:00:00+07:00',
        },
        safetyContext: null,
        exercises: [],
        confirmedPlan: activePlan,
        logs: [],
        checkin: null,
        proposal: null,
        online: true,
        locale: 'en',
        onSave: async () => {},
        ...callbacks,
      }),
    );
    expect(html).toContain(c.pausedTitle);
    expect(html).not.toContain(c.workspaceTitle);
  });

  it('computes live preview expiry without relying on the component mount time', () => {
    expect(
      workoutPreviewExpiryDelay(
        '2026-09-07T08:01:00.000Z',
        Date.parse('2026-09-07T08:00:00.000Z'),
      ),
    ).toBe(60_000);
    expect(
      workoutPreviewExpiryDelay(
        '2026-09-07T07:59:00.000Z',
        Date.parse('2026-09-07T08:00:00.000Z'),
      ),
    ).toBe(0);
  });

  it('renders plan provenance, review disclosure, schedule, prescriptions, substitutions, and unresolved questions', () => {
    const workspace = source('components/dashboard/workout-plan-workspace.tsx');
    for (const token of [
      'catalogReviewStatus',
      'policy.reviewStatus',
      'unreviewedDisclosure',
      'plannerVersion',
      'safetyContextVersion',
      'inputDigest',
      'session.sections',
      'rationaleCopyKey',
      'substitutionIds',
      'unresolvedQuestions',
    ])
      expect(workspace).toContain(token);
  });

  it('keeps initial activation, replacement, adaptation confirmation, and dismissal explicit', () => {
    const workspace = source('components/dashboard/workout-plan-workspace.tsx');
    const actions = source('components/dashboard/use-workout-actions.ts');
    expect(workspace).toContain('onConfirmPlan(preview.previewId)');
    expect(workspace).toContain('c.workouts.replacePlan');
    expect(workspace).toContain('onConfirmProposal(proposal.id)');
    expect(workspace).toContain('onDismissProposal(proposal.id)');
    expect(actions).toContain("method: 'DELETE'");
    expect(actions).toContain("method: 'POST'");
  });

  it('captures every exercise result plus structured recovery and surfaces safety stops', () => {
    const workspace = source('components/dashboard/workout-plan-workspace.tsx');
    for (const token of [
      'exerciseResults',
      "status: 'completed'",
      'value="modified"',
      'value="skipped"',
      'actualSets',
      'actualReps',
      'actualDurationMinutes',
      'substitutionId',
      'concerningSymptoms',
      'WorkoutRecoveryInput',
      "['good', c.workouts.recoveryGood]",
      "['some_fatigue', c.workouts.recoveryFatigue]",
      "['poor', c.workouts.recoveryPoor]",
    ])
      expect(workspace).toContain(token);
  });

  it('covers mobile, keyboard, screen-reader, loading, empty, offline, stale, recovery, and safety-blocked states', () => {
    const workspace = source('components/dashboard/workout-plan-workspace.tsx');
    const readiness = source(
      'components/dashboard/workout-readiness-surface.tsx',
    );
    const copy = source('lib/copy.ts');
    expect(workspace).toContain('sm:grid-cols-2');
    expect(workspace).toContain('<fieldset>');
    expect(workspace).toContain('<legend');
    expect(workspace).toContain('aria-live="polite"');
    expect(workspace).toContain('LoaderCircle');
    expect(workspace).toContain('noActivePlan');
    expect(workspace).toContain('offlineDescription');
    expect(workspace).toContain('previewIsExpired');
    expect(workspace).toContain('key={`log-${activeV2.id}`}');
    expect(workspace).toContain('key={`recovery-${activeV2.id}`}');
    expect(copy).toContain("expired: 'Expired; run a new check-in'");
    expect(workspace).toContain('recoveryTitle');
    expect(readiness).toContain("status === 'cleared'");
    expect(readiness).toContain('pausedTitle');
  });

  it('never queues sensitive workout writes while offline', () => {
    const workspace = source('components/dashboard/workout-plan-workspace.tsx');
    const readiness = source(
      'components/dashboard/workout-readiness-surface.tsx',
    );
    expect(workspace).toContain('disabled={!online');
    expect(readiness).toContain('disabled={saving || !online}');
    expect(workspace).not.toContain('localStorage');
    expect(workspace).not.toContain('indexedDB');
    expect(workspace).not.toContain('serviceWorker');
  });

  it('provides the new plan, logging, recovery, and proposal copy in both locales', () => {
    for (const locale of ['en', 'vi'] as const) {
      const workouts = getCopy(locale).workouts;
      for (const value of [
        workouts.unreviewedDisclosure,
        workouts.workspaceDescription,
        workouts.stopForSafetyDescription,
        workouts.recoveryDescription,
        workouts.confirmProposal,
        workouts.dismissProposal,
        workouts.offlineDescription,
      ])
        expect(value.trim().length).toBeGreaterThan(20);
    }
  });

  it('loads the latest proposal with the rest of the read-only dashboard bootstrap', () => {
    const bootstrap = source('lib/dashboard-bootstrap.ts');
    const dashboard = source('app/dashboard.tsx');
    expect(bootstrap).toContain("'/api/workout-plan-proposals'");
    expect(bootstrap).toContain('proposal: proposal.ok');
    expect(dashboard).toContain('setWorkoutProposal(data.proposal)');
  });
});
