import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type {
  WorkoutCheckin,
  WorkoutLog,
  WorkoutLogRequest,
  WorkoutPlanResponse,
  WorkoutReadiness,
  WorkoutReadinessRequest,
} from '@/lib/contracts';
import { getCopy, type Locale } from '@/lib/copy';
import { createDashboardRequestId } from '@/lib/dashboard-client';

type Options = {
  locale: Locale;
  setReadiness: Dispatch<SetStateAction<WorkoutReadiness | null>>;
  setPlan: Dispatch<SetStateAction<WorkoutPlanResponse | null>>;
  setLogs: Dispatch<SetStateAction<WorkoutLog[]>>;
  setCheckin: Dispatch<SetStateAction<WorkoutCheckin | null>>;
  setError: (message: string) => void;
  setNotice: (message: string) => void;
};

/** Keeps the workout safety and confirmation mutations outside the dashboard shell. */
export function useWorkoutActions(options: Options) {
  const {
    locale,
    setReadiness,
    setPlan,
    setLogs,
    setCheckin,
    setError,
    setNotice,
  } = options;
  const c = getCopy(locale);

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
      setNotice(
        body.status === 'cleared'
          ? c.feedback.readinessCleared
          : c.feedback.readinessPaused,
      );
    },
    [c.feedback, setError, setNotice, setReadiness],
  );

  const previewWorkoutPlan = useCallback(async () => {
    const response = await fetch('/api/workout-plans/preview', {
      method: 'POST',
    });
    const body = (await response.json()) as WorkoutPlanResponse & {
      error?: string;
    };
    if (!response.ok)
      throw new Error(body.error || c.feedback.planPreviewError);
    return body;
  }, [c.feedback.planPreviewError]);

  const confirmWorkoutPlan = useCallback(
    async (plan: WorkoutPlanResponse['plan']) => {
      const response = await fetch('/api/workout-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: createDashboardRequestId(),
          plan,
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        plan?: WorkoutPlanResponse;
        replayed?: boolean;
      };
      if (!response.ok || !body.plan)
        throw new Error(body.error || c.feedback.planConfirmError);
      setPlan(body.plan);
      setNotice(
        body.replayed ? c.feedback.planReplayed : c.feedback.planConfirmed,
      );
    },
    [c.feedback, setNotice, setPlan],
  );

  const saveWorkoutLog = useCallback(
    async (log: WorkoutLogRequest) => {
      const response = await fetch('/api/workout-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log),
      });
      const body = (await response.json()) as {
        error?: string;
        log?: WorkoutLog;
        replayed?: boolean;
      };
      if (!response.ok || !body.log)
        throw new Error(body.error || c.feedback.workoutLogSaveError);
      setLogs((current) => [body.log!, ...current]);
      setNotice(
        body.log.requiresReview
          ? c.feedback.workoutLogReview
          : c.feedback.workoutLogSaved,
      );
    },
    [c.feedback, setLogs, setNotice],
  );

  const runWorkoutCheckin = useCallback(
    async (planId: string) => {
      const response = await fetch('/api/workout-checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: createDashboardRequestId(),
          planId,
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        checkin?: WorkoutCheckin;
      };
      if (!response.ok || !body.checkin)
        throw new Error(body.error || c.feedback.checkinError);
      setCheckin(body.checkin);
    },
    [c.feedback.checkinError, setCheckin],
  );

  return {
    saveWorkoutReadiness,
    previewWorkoutPlan,
    confirmWorkoutPlan,
    saveWorkoutLog,
    runWorkoutCheckin,
  };
}
