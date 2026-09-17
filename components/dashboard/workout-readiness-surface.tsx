'use client';

import { type SyntheticEvent, useState } from 'react';
import { Activity, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type {
  EffectiveSafetyContext,
  WorkoutReadiness,
  WorkoutReadinessRequest,
} from '@/lib/contracts';
import { getCopy, type Locale } from '@/lib/copy';
import { createDashboardRequestId } from '@/lib/dashboard-client';
import {
  workoutReadinessFlags,
  type WorkoutReadinessFlag,
} from '@/lib/dashboard-model';
import type { ExerciseCatalogEntry } from '@/lib/exercise-catalog';
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
import { SafetyContextSummary } from './safety-context-summary';
import { WorkoutPlanWorkspace } from './workout-plan-workspace';

export function WorkoutReadinessSurface({
  readiness,
  safetyContext,
  exercises,
  confirmedPlan,
  logs,
  checkin,
  proposal,
  online,
  onSave,
  onPreview,
  onConfirmPlan,
  onSaveLog,
  onRunCheckin,
  onConfirmProposal,
  onDismissProposal,
  locale,
}: {
  readiness: WorkoutReadiness | null;
  safetyContext: EffectiveSafetyContext | null;
  exercises: ExerciseCatalogEntry[];
  confirmedPlan: ActiveWorkoutPlan | null;
  logs: WorkoutEvidenceLog[];
  checkin: WorkoutEvidenceCheckin | null;
  proposal: WorkoutAdaptationProposal | null;
  online: boolean;
  onSave: (readiness: WorkoutReadinessRequest) => Promise<void>;
  onPreview: () => Promise<WorkoutPlanPreviewResponse>;
  onConfirmPlan: (previewId: string) => Promise<void>;
  onSaveLog: (log: WorkoutEvidenceRequest) => Promise<void>;
  onRunCheckin: (
    planId: string,
    recovery: WorkoutRecoveryInput,
  ) => Promise<void>;
  onConfirmProposal: (proposalId: string) => Promise<void>;
  onDismissProposal: (proposalId: string) => Promise<void>;
  locale: Locale;
}) {
  const [answers, setAnswers] = useState<Record<WorkoutReadinessFlag, boolean>>(
    {
      chestPain: false,
      faintingOrDizziness: false,
      severeShortnessOfBreath: false,
      irregularHeartbeat: false,
      clinicianRestriction: false,
      exerciseGlucoseRisk: false,
    },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const c = getCopy(locale);
  const labels: Record<WorkoutReadinessFlag, string> = {
    chestPain: c.workouts.chestPain,
    faintingOrDizziness: c.workouts.faintingOrDizziness,
    severeShortnessOfBreath: c.workouts.severeShortnessOfBreath,
    irregularHeartbeat: c.workouts.irregularHeartbeat,
    clinicianRestriction: c.workouts.clinicianRestriction,
    exerciseGlucoseRisk: c.workouts.exerciseGlucoseRisk,
  };
  const status = readiness?.status ?? 'not_completed';

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({ idempotencyKey: createDashboardRequestId(), ...answers });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : c.feedback.readinessSaveError,
      );
    } finally {
      setSaving(false);
    }
  }

  const resultCopy =
    status === 'cleared'
      ? {
          title: c.workouts.clearedTitle,
          description: c.workouts.clearedDescription,
          tone: 'border-emerald-200 bg-emerald-50 text-emerald-950',
        }
      : status === 'needs_review'
        ? {
            title: c.workouts.pausedTitle,
            description: c.workouts.pausedDescription,
            tone: 'border-rose-200 bg-rose-50 text-rose-950',
          }
        : {
            title: c.workouts.incompleteTitle,
            description: c.workouts.incompleteDescription,
            tone: 'border-amber-200 bg-amber-50 text-amber-950',
          };

  return (
    <section className="mx-auto max-w-5xl">
      <div>
        <p className="text-sm font-medium text-slate-500">
          {c.workouts.eyebrow} · {c.common.private}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          {c.workouts.title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          {c.workouts.description}
        </p>
      </div>
      <div className="mt-7">
        <SafetyContextSummary context={safetyContext} locale={locale} />
      </div>
      <div className="mt-7 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>{c.workouts.screeningTitle}</CardTitle>
            <CardDescription>{c.workouts.screeningDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              {workoutReadinessFlags.map((flag) => (
                <label
                  key={flag}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm leading-5"
                >
                  <input
                    type="checkbox"
                    checked={answers[flag]}
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        [flag]: event.target.checked,
                      }))
                    }
                    className="mt-0.5 size-4 accent-emerald-800"
                  />
                  <span>{labels[flag]}</span>
                </label>
              ))}
              {error ? (
                <p
                  role="alert"
                  className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900"
                >
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                disabled={saving || !online}
                className="w-full bg-emerald-800 hover:bg-emerald-900"
              >
                {saving ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <ShieldCheck />
                )}{' '}
                {saving ? c.common.saving : c.workouts.confirm}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card className={`border shadow-sm ${resultCopy.tone}`}>
          <CardHeader>
            <div className="grid size-11 place-items-center rounded-xl bg-white/70">
              <Activity className="size-5" />
            </div>
            <CardTitle className="mt-4">{resultCopy.title}</CardTitle>
            <CardDescription className="text-inherit/80">
              {resultCopy.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6">{c.safety.stopTraining}</p>
            <p className="mt-3 text-sm leading-6">
              {c.safety.clinicianPriority}
            </p>
          </CardContent>
        </Card>
      </div>
      {status === 'cleared' ? (
        <div className="mt-10">
          <WorkoutPlanWorkspace
            exercises={exercises}
            confirmedPlan={confirmedPlan}
            logs={logs}
            checkin={checkin}
            proposal={proposal}
            online={online}
            onPreview={onPreview}
            onConfirmPlan={onConfirmPlan}
            onSaveLog={onSaveLog}
            onRunCheckin={onRunCheckin}
            onConfirmProposal={onConfirmProposal}
            onDismissProposal={onDismissProposal}
            locale={locale}
          />
        </div>
      ) : null}
    </section>
  );
}
