'use client';

import { type SyntheticEvent, useState } from 'react';
import {
  Activity,
  Check,
  ClipboardCheck,
  LoaderCircle,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import {
  workoutReadinessFlags,
  type WorkoutReadinessFlag,
} from '@/lib/dashboard-model';
import type { ExerciseCatalogEntry } from '@/lib/exercise-catalog';

const requestId = createDashboardRequestId;

export function WorkoutReadinessSurface({
  readiness,
  exercises,
  confirmedPlan,
  logs,
  checkin,
  onSave,
  onPreview,
  onConfirmPlan,
  onSaveLog,
  onRunCheckin,
  locale,
}: {
  readiness: WorkoutReadiness | null;
  exercises: ExerciseCatalogEntry[];
  confirmedPlan: WorkoutPlanResponse | null;
  logs: WorkoutLog[];
  checkin: WorkoutCheckin | null;
  onSave: (readiness: WorkoutReadinessRequest) => Promise<void>;
  onPreview: () => Promise<WorkoutPlanResponse>;
  onConfirmPlan: (plan: WorkoutPlanResponse['plan']) => Promise<void>;
  onSaveLog: (log: WorkoutLogRequest) => Promise<void>;
  onRunCheckin: (planId: string) => Promise<void>;
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
  const [previewPlan, setPreviewPlan] = useState<WorkoutPlanResponse | null>(
    null,
  );
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [confirmingPlan, setConfirmingPlan] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
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
      await onSave({ idempotencyKey: requestId(), ...answers });
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

  async function generatePreview() {
    setGeneratingPlan(true);
    setError('');
    try {
      setPreviewPlan(await onPreview());
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : c.feedback.planPreviewError,
      );
    } finally {
      setGeneratingPlan(false);
    }
  }

  async function confirmPlan() {
    if (!previewPlan) return;
    setConfirmingPlan(true);
    setError('');
    try {
      await onConfirmPlan(previewPlan.plan);
      setPreviewPlan(null);
    } catch (confirmationError) {
      setError(
        confirmationError instanceof Error
          ? confirmationError.message
          : c.feedback.planConfirmError,
      );
    } finally {
      setConfirmingPlan(false);
    }
  }

  async function runCheckin() {
    if (!confirmedPlan?.id) return;
    setCheckingIn(true);
    setError('');
    try {
      await onRunCheckin(confirmedPlan.id);
    } catch (checkinError) {
      setError(
        checkinError instanceof Error
          ? checkinError.message
          : c.feedback.checkinError,
      );
    } finally {
      setCheckingIn(false);
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
    <section className="mx-auto max-w-3xl">
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
                <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                disabled={saving}
                className="w-full bg-emerald-800 hover:bg-emerald-900"
              >
                {saving ? (
                  <>
                    <LoaderCircle className="animate-spin" /> {c.common.saving}
                  </>
                ) : (
                  <>
                    <ShieldCheck /> {c.workouts.confirm}
                  </>
                )}
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
        <div className="mt-8 space-y-8">
          <section>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">
                  {c.workouts.planTitle}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  {confirmedPlan
                    ? c.workouts.confirmedPlanNote
                    : c.workouts.planPreviewNote}
                </p>
              </div>
              {!confirmedPlan ? (
                <Button
                  type="button"
                  disabled={generatingPlan}
                  onClick={() => void generatePreview()}
                  className="bg-emerald-800 hover:bg-emerald-900"
                >
                  {generatingPlan ? (
                    <>
                      <LoaderCircle className="animate-spin" />{' '}
                      {c.common.loading}
                    </>
                  ) : (
                    <>
                      <ClipboardCheck /> {c.workouts.previewPlan}
                    </>
                  )}
                </Button>
              ) : null}
            </div>
            {previewPlan || confirmedPlan ? (
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {(previewPlan ?? confirmedPlan)!.plan.sessions.map(
                  (session) => (
                    <Card
                      key={session.id}
                      className="border-slate-200 shadow-sm"
                    >
                      <CardHeader className="pb-3">
                        <CardDescription>
                          {session.durationMinutes} {c.workouts.minutes} ·{' '}
                          {c.workouts.effort} RPE {session.rpe}/10
                        </CardDescription>
                        <CardTitle className="mt-1 text-lg">
                          {session.title[locale]}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm leading-6">
                        <p>{session.rationale[locale]}</p>
                        {session.warmup ? (
                          <p className="text-slate-600">
                            <span className="font-medium text-slate-900">
                              {c.workouts.warmup}:
                            </span>{' '}
                            {session.warmup[locale]}
                          </p>
                        ) : null}
                        <ul className="list-disc space-y-1 pl-5 text-slate-600">
                          {(
                            session.prescriptions ??
                            session.exerciseIds.map((exerciseId) => ({
                              exerciseId,
                            }))
                          ).map(
                            (prescription: {
                              exerciseId: string;
                              sets?: number;
                              reps?: number;
                              durationMinutes?: number;
                              restSeconds?: number;
                            }) => {
                              const details = [
                                prescription.sets && prescription.reps
                                  ? `${prescription.sets} ${c.workouts.sets.toLowerCase()} × ${prescription.reps} ${c.workouts.reps.toLowerCase()}`
                                  : null,
                                prescription.durationMinutes
                                  ? `${prescription.durationMinutes} ${c.workouts.minutes}`
                                  : null,
                                prescription.restSeconds !== undefined
                                  ? `${c.workouts.rest} ${prescription.restSeconds}s`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(' · ');
                              return (
                                <li key={prescription.exerciseId}>
                                  {exercises.find(
                                    (exercise) =>
                                      exercise.id === prescription.exerciseId,
                                  )?.name[locale] ?? prescription.exerciseId}
                                  {details ? ` — ${details}` : ''}
                                </li>
                              );
                            },
                          )}
                        </ul>
                        {session.cooldown ? (
                          <p className="text-slate-600">
                            <span className="font-medium text-slate-900">
                              {c.workouts.cooldown}:
                            </span>{' '}
                            {session.cooldown[locale]}
                          </p>
                        ) : null}
                        {session.progressionCriteria ? (
                          <p className="text-slate-600">
                            <span className="font-medium text-slate-900">
                              {c.workouts.progressionCriteria}:
                            </span>{' '}
                            {session.progressionCriteria[locale]}
                          </p>
                        ) : null}
                        <p className="text-xs text-slate-500">
                          {session.safetyNote[locale]}
                        </p>
                      </CardContent>
                    </Card>
                  ),
                )}
              </div>
            ) : null}
            {previewPlan ? (
              <Button
                type="button"
                disabled={confirmingPlan}
                onClick={() => void confirmPlan()}
                className="mt-5 bg-emerald-800 hover:bg-emerald-900"
              >
                {confirmingPlan ? (
                  <>
                    <LoaderCircle className="animate-spin" /> {c.common.saving}
                  </>
                ) : (
                  <>
                    <Check /> {c.workouts.confirmPlan}
                  </>
                )}
              </Button>
            ) : null}
            {confirmedPlan ? (
              <WorkoutLogForm
                plan={confirmedPlan}
                logs={logs}
                onSave={onSaveLog}
                locale={locale}
              />
            ) : null}
            {confirmedPlan ? (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{c.workouts.checkinTitle}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {checkin
                        ? checkin.action === 'hold_for_review'
                          ? c.workouts.checkinHold
                          : checkin.action === 'repeat'
                            ? c.workouts.checkinRepeat
                            : c.workouts.checkinMaintain
                        : c.workouts.planPreviewNote}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={checkingIn}
                    onClick={() => void runCheckin()}
                  >
                    {checkingIn ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <ClipboardCheck />
                    )}{' '}
                    {c.workouts.checkin}
                  </Button>
                </div>
              </div>
            ) : null}
          </section>
          <section>
            <h2 className="text-xl font-semibold">{c.workouts.catalogTitle}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {c.workouts.catalogDescription}
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {exercises.map((exercise) => (
                <Card key={exercise.id} className="border-slate-200 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardDescription className="capitalize">
                      {exercise.category}
                    </CardDescription>
                    <CardTitle className="mt-1 text-lg">
                      {exercise.name[locale]}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm leading-6">
                    <p>
                      <span className="font-medium">
                        {c.workouts.equipment}:{' '}
                      </span>
                      {exercise.equipment.join(', ')}
                    </p>
                    <p>
                      <span className="font-medium">
                        {c.workouts.technique}:{' '}
                      </span>
                      {exercise.technique[locale]}
                    </p>
                    <p className="text-slate-600">
                      <span className="font-medium text-slate-800">
                        {c.workouts.regression}:
                      </span>
                      {exercise.regression[locale]}
                    </p>
                    <p className="text-slate-600">
                      <span className="font-medium text-slate-800">
                        {c.workouts.progression}:
                      </span>
                      {exercise.progression[locale]}
                    </p>
                  </CardContent>
                </Card>
              ))}
              {!exercises.length ? (
                <p className="text-sm text-slate-500">
                  {c.workouts.catalogEmpty}
                </p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function WorkoutLogForm({
  plan,
  logs,
  onSave,
  locale,
}: {
  plan: WorkoutPlanResponse;
  logs: WorkoutLog[];
  onSave: (log: WorkoutLogRequest) => Promise<void>;
  locale: Locale;
}) {
  const [sessionId, setSessionId] = useState(plan.plan.sessions[0]?.id ?? '');
  const [durationMinutes, setDurationMinutes] = useState('20');
  const [rpe, setRpe] = useState('3');
  const [enjoyment, setEnjoyment] = useState('3');
  const [setsCompleted, setSetsCompleted] = useState('');
  const [repsPerSet, setRepsPerSet] = useState('');
  const [load, setLoad] = useState('');
  const [loadUnit, setLoadUnit] = useState<'kg' | 'lb'>('kg');
  const [averageHeartRate, setAverageHeartRate] = useState('');
  const [pain, setPain] = useState(false);
  const [concerningSymptoms, setConcerningSymptoms] = useState(false);
  const [preGlucose, setPreGlucose] = useState('');
  const [postGlucose, setPostGlucose] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const c = getCopy(locale);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const duration = Number(durationMinutes);
    const actualRpe = Number(rpe);
    const actualEnjoyment = Number(enjoyment);
    const actualSets = setsCompleted ? Number(setsCompleted) : undefined;
    const actualReps = repsPerSet ? Number(repsPerSet) : undefined;
    const actualLoad = load ? Number(load) : undefined;
    const actualHeartRate = averageHeartRate
      ? Number(averageHeartRate)
      : undefined;
    const before = preGlucose ? Number(preGlucose) : undefined;
    const after = postGlucose ? Number(postGlucose) : undefined;
    if (
      !Number.isInteger(duration) ||
      duration < 1 ||
      !Number.isInteger(actualRpe) ||
      actualRpe < 1 ||
      actualRpe > 10 ||
      !Number.isInteger(actualEnjoyment) ||
      actualEnjoyment < 1 ||
      actualEnjoyment > 5 ||
      (actualSets === undefined) !== (actualReps === undefined) ||
      (actualSets !== undefined &&
        (!Number.isInteger(actualSets) || actualSets < 1)) ||
      (actualReps !== undefined &&
        (!Number.isInteger(actualReps) || actualReps < 1)) ||
      (actualLoad !== undefined &&
        (!Number.isFinite(actualLoad) || actualLoad <= 0)) ||
      (actualHeartRate !== undefined &&
        (!Number.isInteger(actualHeartRate) ||
          actualHeartRate < 20 ||
          actualHeartRate > 260)) ||
      (before !== undefined && (!Number.isFinite(before) || before <= 0)) ||
      (after !== undefined && (!Number.isFinite(after) || after <= 0))
    ) {
      setError(c.feedback.workoutLogValidation);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        idempotencyKey: requestId(),
        planId: plan.id!,
        sessionId,
        durationMinutes: duration,
        rpe: actualRpe,
        enjoyment: actualEnjoyment,
        ...(actualSets === undefined ? {} : { setsCompleted: actualSets }),
        ...(actualReps === undefined ? {} : { repsPerSet: actualReps }),
        ...(actualLoad === undefined ? {} : { load: actualLoad, loadUnit }),
        ...(actualHeartRate === undefined
          ? {}
          : { averageHeartRate: actualHeartRate }),
        pain,
        concerningSymptoms,
        ...(before === undefined ? {} : { preGlucose: before }),
        ...(after === undefined ? {} : { postGlucose: after }),
      });
      setPain(false);
      setConcerningSymptoms(false);
      setPreGlucose('');
      setPostGlucose('');
      setSetsCompleted('');
      setRepsPerSet('');
      setLoad('');
      setAverageHeartRate('');
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : c.feedback.workoutLogSaveError,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_.9fr]">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>{c.workouts.logTitle}</CardTitle>
          <CardDescription>{c.workouts.safetyLogNote}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm font-medium">
              {c.workouts.session}
              <select
                value={sessionId}
                onChange={(event) => setSessionId(event.target.value)}
                className="mt-2 flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-sm"
              >
                {plan.plan.sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.title[locale]}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className="text-sm font-medium">
                {c.workouts.duration} ({c.workouts.minutes})
                <Input
                  className="mt-2 bg-white"
                  type="number"
                  min="1"
                  max="300"
                  value={durationMinutes}
                  onChange={(event) => setDurationMinutes(event.target.value)}
                  required
                />
              </label>
              <label className="text-sm font-medium">
                {c.workouts.effort} RPE
                <Input
                  className="mt-2 bg-white"
                  type="number"
                  min="1"
                  max="10"
                  value={rpe}
                  onChange={(event) => setRpe(event.target.value)}
                  required
                />
              </label>
              <label className="text-sm font-medium">
                {c.workouts.enjoyment} /5
                <Input
                  className="mt-2 bg-white"
                  type="number"
                  min="1"
                  max="5"
                  value={enjoyment}
                  onChange={(event) => setEnjoyment(event.target.value)}
                  required
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="text-sm font-medium">
                {c.workouts.sets}
                <Input
                  className="mt-2 bg-white"
                  type="number"
                  min="1"
                  value={setsCompleted}
                  onChange={(event) => setSetsCompleted(event.target.value)}
                />
              </label>
              <label className="text-sm font-medium">
                {c.workouts.reps}
                <Input
                  className="mt-2 bg-white"
                  type="number"
                  min="1"
                  value={repsPerSet}
                  onChange={(event) => setRepsPerSet(event.target.value)}
                />
              </label>
              <label className="text-sm font-medium">
                {c.workouts.load}
                <div className="mt-2 flex gap-1">
                  <Input
                    className="min-w-0 bg-white"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={load}
                    onChange={(event) => setLoad(event.target.value)}
                  />
                  <select
                    value={loadUnit}
                    onChange={(event) =>
                      setLoadUnit(event.target.value as 'kg' | 'lb')
                    }
                    className="rounded-md border border-input bg-white px-2 text-sm"
                  >
                    <option value="kg">kg</option>
                    <option value="lb">lb</option>
                  </select>
                </div>
              </label>
              <label className="text-sm font-medium">
                {c.workouts.heartRate}
                <Input
                  className="mt-2 bg-white"
                  type="number"
                  min="20"
                  max="260"
                  value={averageHeartRate}
                  onChange={(event) => setAverageHeartRate(event.target.value)}
                />
              </label>
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm">
              <input
                type="checkbox"
                checked={pain}
                onChange={(event) => setPain(event.target.checked)}
                className="mt-0.5 size-4 accent-rose-700"
              />
              {c.workouts.pain}
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm">
              <input
                type="checkbox"
                checked={concerningSymptoms}
                onChange={(event) =>
                  setConcerningSymptoms(event.target.checked)
                }
                className="mt-0.5 size-4 accent-rose-700"
              />
              {c.workouts.concerningSymptoms}
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                {c.workouts.preGlucose}
                <Input
                  className="mt-2 bg-white"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={preGlucose}
                  onChange={(event) => setPreGlucose(event.target.value)}
                />
              </label>
              <label className="text-sm font-medium">
                {c.workouts.postGlucose}
                <Input
                  className="mt-2 bg-white"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={postGlucose}
                  onChange={(event) => setPostGlucose(event.target.value)}
                />
              </label>
            </div>
            {error ? (
              <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={saving}
              className="w-full bg-emerald-800 hover:bg-emerald-900"
            >
              {saving ? (
                <>
                  <LoaderCircle className="animate-spin" /> {c.common.saving}
                </>
              ) : (
                <>
                  <Check /> {c.workouts.saveLog}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>{c.workouts.logHistory}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {logs.slice(0, 6).map((log) => (
            <div
              key={log.id}
              className="rounded-xl border border-slate-100 p-3 text-sm"
            >
              <p className="font-semibold">
                {plan.plan.sessions.find(
                  (session) => session.id === log.sessionId,
                )?.title[locale] ?? log.sessionId}
              </p>
              <p className="mt-1 text-slate-600">
                {log.durationMinutes} {c.workouts.minutes} · RPE {log.rpe}/10
                {log.enjoyment === null
                  ? ''
                  : ` · ${c.workouts.enjoyment} ${log.enjoyment}/5`}
              </p>
              {log.setsCompleted !== null && log.repsPerSet !== null ? (
                <p className="mt-1 text-slate-600">
                  {log.setsCompleted} × {log.repsPerSet}
                  {log.load === null ? '' : ` · ${log.load} ${log.loadUnit}`}
                  {log.averageHeartRate === null
                    ? ''
                    : ` · ${log.averageHeartRate} bpm`}
                </p>
              ) : log.averageHeartRate === null ? null : (
                <p className="mt-1 text-slate-600">
                  {log.averageHeartRate} bpm
                </p>
              )}
              {log.requiresReview ? (
                <p className="mt-2 text-xs font-medium text-rose-800">
                  {c.workouts.safetyLogNote}
                </p>
              ) : null}
            </div>
          ))}
          {!logs.length ? (
            <p className="text-sm text-slate-500">{c.workouts.noLogs}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
