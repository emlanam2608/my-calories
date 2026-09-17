import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type {
  WorkoutReadiness,
  WorkoutReadinessRequest,
  SafetyReasonCode,
} from '@/lib/contracts';
import { getCopy, type Locale } from '@/lib/copy';
import { createDashboardRequestId } from '@/lib/dashboard-client';
import type {
  ActiveWorkoutPlan,
  WorkoutPlanPreviewResponse,
} from '@/lib/workout-plan-lifecycle';
import type {
  WorkoutEvidenceCheckin,
  WorkoutEvidenceLog,
  WorkoutEvidenceRequest,
  WorkoutRecoveryInput,
} from '@/lib/workout-evidence';
import type { WorkoutAdaptationProposal } from '@/lib/workout-adaptation-contracts';

type Options = {
  locale: Locale;
  setReadiness: Dispatch<SetStateAction<WorkoutReadiness | null>>;
  setPlan: Dispatch<SetStateAction<ActiveWorkoutPlan | null>>;
  setLogs: Dispatch<SetStateAction<WorkoutEvidenceLog[]>>;
  setCheckin: Dispatch<SetStateAction<WorkoutEvidenceCheckin | null>>;
  setProposal: Dispatch<SetStateAction<WorkoutAdaptationProposal | null>>;
  setError: (message: string) => void;
  setNotice: (message: string) => void;
  reload: () => Promise<void>;
};

/** Keeps the workout safety and confirmation mutations outside the dashboard shell. */
export function useWorkoutActions(options: Options) {
  const {
    locale,
    setReadiness,
    setPlan,
    setLogs,
    setCheckin,
    setProposal,
    setError,
    setNotice,
    reload,
  } = options;
  const c = getCopy(locale);
  const safetyError = useCallback(
    (
      body: {
        error?: string;
        errorCode?: string;
        reasons?: Array<{ code: SafetyReasonCode }>;
      },
      fallback: string,
    ) => {
      if (
        body.errorCode !== 'exercise_recommendation_blocked' ||
        !body.reasons?.length
      )
        return body.error || fallback;
      const labels = c.safetyContext.reasons as Record<
        SafetyReasonCode,
        string
      >;
      return body.reasons.map((reason) => labels[reason.code]).join(' ');
    },
    [c.safetyContext.reasons],
  );

  const saveWorkoutReadiness = useCallback(
    async (readiness: WorkoutReadinessRequest) => {
      setError('');
      setNotice('');
      const response = await fetch('/api/workouts/readiness', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(readiness),
      });
      const body = (await response.json()) as WorkoutReadiness & {
        error?: string;
        replayed?: boolean;
      };
      if (!response.ok)
        throw new Error(body.error || c.feedback.readinessSaveError);
      setReadiness(body);
      await reload();
      setNotice(
        body.status === 'cleared'
          ? c.feedback.readinessCleared
          : c.feedback.readinessPaused,
      );
    },
    [c.feedback, reload, setError, setNotice, setReadiness],
  );

  const previewWorkoutPlan = useCallback(async () => {
    const response = await fetch('/api/workout-plans/preview', {
      method: 'POST',
    });
    const body = (await response.json()) as WorkoutPlanPreviewResponse & {
      error?: string;
      errorCode?: string;
      reasons?: Array<{ code: SafetyReasonCode }>;
    };
    if (!response.ok)
      throw new Error(safetyError(body, c.feedback.planPreviewError));
    return body;
  }, [c.feedback.planPreviewError, safetyError]);

  const confirmWorkoutPlan = useCallback(
    async (previewId: string) => {
      const response = await fetch('/api/workout-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: createDashboardRequestId(),
          previewId,
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        errorCode?: string;
        reasons?: Array<{ code: SafetyReasonCode }>;
        plan?: ActiveWorkoutPlan;
        replayed?: boolean;
      };
      if (!response.ok || !body.plan)
        throw new Error(safetyError(body, c.feedback.planConfirmError));
      setPlan(body.plan);
      setNotice(
        body.replayed ? c.feedback.planReplayed : c.feedback.planConfirmed,
      );
    },
    [c.feedback, safetyError, setNotice, setPlan],
  );

  const saveWorkoutLog = useCallback(
    async (log: WorkoutEvidenceRequest) => {
      const response = await fetch('/api/workout-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log),
      });
      const body = (await response.json()) as {
        error?: string;
        log?: WorkoutEvidenceLog;
        replayed?: boolean;
      };
      if (!response.ok || !body.log)
        throw new Error(body.error || c.feedback.workoutLogSaveError);
      setLogs((current) => [body.log!, ...current]);
      await reload();
      setNotice(
        body.log.requiresReview
          ? c.feedback.workoutLogReview
          : c.feedback.workoutLogSaved,
      );
    },
    [c.feedback, reload, setLogs, setNotice],
  );

  const runWorkoutCheckin = useCallback(
    async (planId: string, recovery: WorkoutRecoveryInput) => {
      const response = await fetch('/api/workout-checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: createDashboardRequestId(),
          planId,
          recovery,
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        checkin?: WorkoutEvidenceCheckin;
        proposal?: WorkoutAdaptationProposal | null;
      };
      if (!response.ok || !body.checkin)
        throw new Error(body.error || c.feedback.checkinError);
      setCheckin(body.checkin);
      setProposal(body.proposal ?? null);
    },
    [c.feedback.checkinError, setCheckin, setProposal],
  );

  const confirmWorkoutProposal = useCallback(
    async (proposalId: string) => {
      const response = await fetch('/api/workout-plan-proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: createDashboardRequestId(),
          proposalId,
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        plan?: ActiveWorkoutPlan;
        proposal?: WorkoutAdaptationProposal;
      };
      if (!response.ok || !body.plan || !body.proposal)
        throw new Error(body.error || c.feedback.planConfirmError);
      setPlan(body.plan);
      setProposal(body.proposal);
      setNotice(c.feedback.planConfirmed);
    },
    [
      c.feedback.planConfirmError,
      c.feedback.planConfirmed,
      setNotice,
      setPlan,
      setProposal,
    ],
  );

  const dismissWorkoutProposal = useCallback(
    async (proposalId: string) => {
      const response = await fetch('/api/workout-plan-proposals', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: createDashboardRequestId(),
          proposalId,
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        proposal?: WorkoutAdaptationProposal;
      };
      if (!response.ok || !body.proposal)
        throw new Error(body.error || c.feedback.planConfirmError);
      setProposal(body.proposal);
    },
    [c.feedback.planConfirmError, setProposal],
  );

  return {
    saveWorkoutReadiness,
    previewWorkoutPlan,
    confirmWorkoutPlan,
    saveWorkoutLog,
    runWorkoutCheckin,
    confirmWorkoutProposal,
    dismissWorkoutProposal,
  };
}
