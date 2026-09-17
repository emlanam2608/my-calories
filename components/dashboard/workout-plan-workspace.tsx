'use client';

import { type SyntheticEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ClipboardCheck,
  Dumbbell,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  WifiOff,
  X,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { createDashboardRequestId } from '@/lib/dashboard-client';
import { getCopy, type Locale } from '@/lib/copy';
import type { ExerciseCatalogEntry } from '@/lib/exercise-catalog';
import type {
  WorkoutEvidenceCheckin,
  WorkoutEvidenceLog,
  WorkoutEvidenceRequest,
  WorkoutRecoveryInput,
} from '@/lib/workout-evidence';
import type {
  ActiveWorkoutPlan,
  WorkoutPlanPreviewResponse,
} from '@/lib/workout-plan-lifecycle';
import type {
  WorkoutPlanV2,
  WorkoutPlanV2Prescription,
} from '@/lib/workout-planning-contracts';
import type { WorkoutAdaptationProposal } from '@/lib/workout-adaptation-contracts';

type ExerciseResultDraft = {
  status: 'completed' | 'modified' | 'skipped';
  sets: string;
  reps: string;
  minutes: string;
  load: string;
  loadUnit: 'kg' | 'lb';
  substitutionId: string;
};

type Props = {
  exercises: ExerciseCatalogEntry[];
  confirmedPlan: ActiveWorkoutPlan | null;
  logs: WorkoutEvidenceLog[];
  checkin: WorkoutEvidenceCheckin | null;
  proposal: WorkoutAdaptationProposal | null;
  online: boolean;
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
};

export function workoutPreviewExpiryDelay(expiresAt: string, now = Date.now()) {
  return Math.max(0, Date.parse(expiresAt) - now);
}

function copyKeyText(copyKey: string, locale: Locale) {
  const token = copyKey.split('.').at(-1) ?? copyKey;
  const known: Record<string, { en: string; vi: string }> = {
    weight_loss: {
      en: 'Supports a consistent movement routine for the selected weight goal.',
      vi: 'Hỗ trợ thói quen vận động đều đặn cho mục tiêu cân nặng đã chọn.',
    },
    maintain_weight: {
      en: 'Supports a consistent routine for maintaining weight.',
      vi: 'Hỗ trợ thói quen đều đặn cho mục tiêu duy trì cân nặng.',
    },
    muscle_gain: {
      en: 'Prioritizes repeatable strength practice for the selected goal.',
      vi: 'Ưu tiên luyện sức mạnh lặp lại được cho mục tiêu đã chọn.',
    },
    fitness: {
      en: 'Builds a balanced weekly movement routine.',
      vi: 'Xây dựng thói quen vận động cân bằng trong tuần.',
    },
    health_tracking: {
      en: 'Uses a conservative routine that can be tracked consistently.',
      vi: 'Dùng thói quen thận trọng có thể theo dõi đều đặn.',
    },
    strength: {
      en: 'Builds strength with a bounded, repeatable dose.',
      vi: 'Rèn sức mạnh với liều tập giới hạn và lặp lại được.',
    },
    aerobic: {
      en: 'Adds moderate aerobic movement within the recorded limits.',
      vi: 'Bổ sung vận động tim mạch vừa sức trong giới hạn đã ghi nhận.',
    },
    mobility: {
      en: 'Supports comfortable range of motion and recovery.',
      vi: 'Hỗ trợ tầm vận động thoải mái và hồi phục.',
    },
    new_to_exercise: {
      en: 'Uses a lower starting dose for someone new to exercise.',
      vi: 'Dùng liều khởi đầu thấp hơn cho người mới tập.',
    },
    beginner: {
      en: 'Uses a conservative beginner dose.',
      vi: 'Dùng liều tập thận trọng cho người mới bắt đầu.',
    },
    regular: {
      en: 'Uses the recorded regular training history without exceeding policy limits.',
      vi: 'Dùng lịch sử tập đều đặn đã ghi nhận nhưng không vượt giới hạn chính sách.',
    },
    recoveryUnavailable: {
      en: 'Recent recovery evidence is unavailable, so the dose stays conservative.',
      vi: 'Chưa có bằng chứng hồi phục gần đây nên liều tập vẫn thận trọng.',
    },
    recoveryEvidenceIncluded: {
      en: 'Recent completion and recovery evidence was included.',
      vi: 'Đã tính đến bằng chứng hoàn thành và hồi phục gần đây.',
    },
    awaitScheduledCheckin: {
      en: 'Change the dose only after the scheduled recovery check-in.',
      vi: 'Chỉ đổi liều tập sau lần đánh giá hồi phục theo lịch.',
    },
    noPainOrSymptoms: {
      en: 'Do not progress when pain or concerning symptoms are reported.',
      vi: 'Không tăng tiến khi đã báo đau hoặc triệu chứng đáng lo.',
    },
    no_available_day: {
      en: 'Choose at least one available workout day.',
      vi: 'Chọn ít nhất một ngày có thể tập.',
    },
    missing_environment: {
      en: 'Record an available workout environment.',
      vi: 'Ghi nhận môi trường có thể tập.',
    },
    missing_mobility_candidate: {
      en: 'No compatible mobility exercise is available.',
      vi: 'Chưa có bài linh hoạt phù hợp.',
    },
    missing_strength_candidate: {
      en: 'No compatible strength exercise is available.',
      vi: 'Chưa có bài sức mạnh phù hợp.',
    },
    missing_aerobic_candidate: {
      en: 'No compatible aerobic exercise is available.',
      vi: 'Chưa có bài tim mạch phù hợp.',
    },
    unresolved_substitution: {
      en: 'A required compatible substitution is not available.',
      vi: 'Chưa có bài thay thế phù hợp theo yêu cầu.',
    },
    safety_blocked: {
      en: 'The current safety context blocks plan progression.',
      vi: 'Bối cảnh an toàn hiện tại chặn tăng tiến kế hoạch.',
    },
    concerning_workout_evidence: {
      en: 'A recent workout contains concerning safety evidence.',
      vi: 'Buổi tập gần đây có bằng chứng an toàn đáng lo.',
    },
    recovery_pain: {
      en: 'Recovery pain requires review before a plan change.',
      vi: 'Đau khi hồi phục cần được xem xét trước khi đổi kế hoạch.',
    },
    exercise_incompatible: {
      en: 'A planned exercise no longer matches the recorded context.',
      vi: 'Một bài trong kế hoạch không còn phù hợp với bối cảnh đã ghi.',
    },
    substitution_unresolved: {
      en: 'No eligible substitution can be applied safely.',
      vi: 'Chưa có bài thay thế đủ điều kiện để áp dụng an toàn.',
    },
    poor_recovery: {
      en: 'Poor recovery supports a lower training dose.',
      vi: 'Hồi phục kém phù hợp với liều tập thấp hơn.',
    },
    some_fatigue: {
      en: 'Some fatigue supports maintaining the current dose.',
      vi: 'Hơi mệt phù hợp với việc giữ nguyên liều tập.',
    },
    excess_effort: {
      en: 'Recorded effort is above the conservative threshold.',
      vi: 'Cường độ đã ghi cao hơn ngưỡng thận trọng.',
    },
    insufficient_evidence: {
      en: 'There is not enough complete evidence to progress.',
      vi: 'Chưa có đủ bằng chứng hoàn chỉnh để tăng tiến.',
    },
    duplicate_session_evidence: {
      en: 'Repeated session evidence is not counted as separate adherence.',
      vi: 'Bằng chứng buổi tập trùng không được tính là tuân thủ riêng.',
    },
    legacy_evidence: {
      en: 'Older aggregate logs cannot support progression.',
      vi: 'Nhật ký tổng hợp cũ không thể làm căn cứ tăng tiến.',
    },
    progression_policy_unreviewed: {
      en: 'Progression stays locked until the policy receives qualified review.',
      vi: 'Tăng tiến vẫn bị khóa đến khi chính sách được thẩm định đủ chuyên môn.',
    },
    progression_criteria_met: {
      en: 'Recorded evidence meets the reviewed progression criteria.',
      vi: 'Bằng chứng đã ghi đáp ứng điều kiện tăng tiến được thẩm định.',
    },
    maintenance_appropriate: {
      en: 'The current evidence supports maintaining the plan.',
      vi: 'Bằng chứng hiện tại phù hợp với việc giữ nguyên kế hoạch.',
    },
    professional_review_required: {
      en: 'Qualified professional review is required.',
      vi: 'Cần thẩm định của chuyên gia đủ chuyên môn.',
    },
    eligible_substitution_required: {
      en: 'An eligible substitution is required.',
      vi: 'Cần một bài thay thế đủ điều kiện.',
    },
    more_exercise_evidence_required: {
      en: 'More complete exercise-level evidence is required.',
      vi: 'Cần thêm bằng chứng đầy đủ ở cấp từng bài tập.',
    },
  };
  const exact = known[token];
  if (exact) return exact[locale];
  return token
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function prescriptionDose(
  prescription: WorkoutPlanV2Prescription,
  locale: Locale,
) {
  const c = getCopy(locale);
  const dose = prescription.sets
    ? `${prescription.sets} ${c.workouts.sets.toLowerCase()} × ${prescription.reps} ${c.workouts.reps.toLowerCase()}`
    : `${prescription.durationMinutes} ${c.workouts.minutes}`;
  return `${dose} · RPE ${prescription.targetRpe}/10 · ${c.workouts.rest} ${prescription.restSeconds ?? 0}s`;
}

function initialResults(plan: WorkoutPlanV2, sessionId: string) {
  const session = plan.sessions.find((item) => item.id === sessionId);
  return Object.fromEntries(
    (session?.sections.flatMap((section) => section.prescriptions) ?? []).map(
      (prescription) => [
        prescription.exerciseId,
        {
          status: 'completed',
          sets: prescription.sets?.toString() ?? '',
          reps: prescription.reps?.toString() ?? '',
          minutes: prescription.durationMinutes?.toString() ?? '',
          load: '',
          loadUnit: 'kg',
          substitutionId: '',
        } satisfies ExerciseResultDraft,
      ],
    ),
  );
}

function PlanDetails({
  plan,
  exercisesById,
  locale,
}: {
  plan: WorkoutPlanV2;
  exercisesById: Map<string, ExerciseCatalogEntry>;
  locale: Locale;
}) {
  const c = getCopy(locale);
  const reviewStatus =
    plan.catalogReviewStatus === 'professionally_reviewed' &&
    plan.policy.reviewStatus === 'professionally_reviewed'
      ? 'professionally_reviewed'
      : 'unreviewed';
  return (
    <div className="space-y-5">
      <Alert
        className={
          reviewStatus === 'unreviewed'
            ? 'border-amber-300 bg-amber-50 text-amber-950'
            : 'border-emerald-200 bg-emerald-50 text-emerald-950'
        }
      >
        {reviewStatus === 'unreviewed' ? <AlertTriangle /> : <Check />}
        <AlertTitle>
          {reviewStatus === 'unreviewed'
            ? c.workouts.unreviewed
            : c.workouts.reviewed}
        </AlertTitle>
        <AlertDescription className="text-inherit/80">
          {reviewStatus === 'unreviewed'
            ? c.workouts.unreviewedDisclosure
            : plan.policy.reviewReference}
        </AlertDescription>
      </Alert>

      <details className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <summary className="cursor-pointer font-semibold">
          {c.workouts.provenance}
        </summary>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            [c.workouts.plannerVersion, plan.plannerVersion],
            [c.workouts.catalogVersion, plan.catalogVersion],
            [c.workouts.policyVersion, plan.policy.version],
            [c.workouts.safetyVersion, plan.safetyContextVersion],
            [c.workouts.inputDigest, `${plan.inputDigest.slice(0, 12)}…`],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {label}
              </dt>
              <dd className="mt-1 break-all font-mono text-xs">{value}</dd>
            </div>
          ))}
        </dl>
      </details>

      {plan.unresolvedQuestions.length ? (
        <Alert variant="destructive">
          <ShieldAlert />
          <AlertTitle>{c.workouts.unresolvedQuestions}</AlertTitle>
          <AlertDescription>
            <p>{c.workouts.incompletePlan}</p>
            <ul className="mt-2 list-disc pl-5">
              {plan.unresolvedQuestions.map((question) => (
                <li key={`${question.code}:${question.exerciseIds.join('-')}`}>
                  {copyKeyText(question.copyKey, locale)}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <section aria-labelledby="weekly-schedule-title">
        <h3 id="weekly-schedule-title" className="text-lg font-semibold">
          {c.workouts.schedule}
        </h3>
        <div className="mt-3 grid gap-4 xl:grid-cols-2">
          {plan.sessions.map((session) => (
            <article
              key={session.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
                    {new Intl.DateTimeFormat(
                      locale === 'vi' ? 'vi-VN' : 'en-US',
                      {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'Asia/Bangkok',
                      },
                    ).format(new Date(`${session.date}T12:00:00+07:00`))}
                  </p>
                  <h4 className="mt-1 font-semibold">
                    {c.workouts.purposes[session.purpose]}
                  </h4>
                </div>
                <Badge variant="outline">
                  {session.durationMinutes} {c.workouts.minutes} · RPE{' '}
                  {session.targetRpe}
                </Badge>
              </div>
              <div className="mt-4 space-y-4">
                <p className="text-sm leading-6 text-slate-600">
                  <span className="font-medium text-slate-800">
                    {c.workouts.rationale}:{' '}
                  </span>
                  {session.rationaleCopyKeys
                    .map((key) => copyKeyText(key, locale))
                    .join(' ')}
                </p>
                {session.sections.map((section) => (
                  <div key={section.phase}>
                    <h5 className="text-sm font-semibold text-slate-800">
                      {c.workouts.phases[section.phase]}
                    </h5>
                    <ul className="mt-2 space-y-3">
                      {section.prescriptions.map((prescription) => {
                        const exercise = exercisesById.get(
                          prescription.exerciseId,
                        );
                        return (
                          <li
                            key={prescription.exerciseId}
                            className="rounded-xl bg-slate-50 p-3 text-sm"
                          >
                            <p className="font-medium">
                              {exercise?.name[locale] ??
                                prescription.exerciseId}
                            </p>
                            <p className="mt-1 text-slate-600">
                              {prescriptionDose(prescription, locale)}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-slate-500">
                              <span className="font-medium text-slate-700">
                                {c.workouts.rationale}:{' '}
                              </span>
                              {copyKeyText(
                                prescription.rationaleCopyKey,
                                locale,
                              )}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-slate-500">
                              <span className="font-medium text-slate-700">
                                {c.workouts.substitutions}:{' '}
                              </span>
                              {prescription.substitutionIds.length
                                ? prescription.substitutionIds
                                    .map(
                                      (id) =>
                                        exercisesById.get(id)?.name[locale] ??
                                        id,
                                    )
                                    .join(', ')
                                : c.workouts.noSubstitutions}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-600">
                <span className="font-medium text-slate-800">
                  {c.workouts.progressionCriteria}:{' '}
                </span>
                {session.progressionCriteriaCopyKeys
                  .map((key) => copyKeyText(key, locale))
                  .join(' ')}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ExerciseLogForm({
  activePlan,
  exercisesById,
  logs,
  online,
  onSave,
  locale,
}: {
  activePlan: ActiveWorkoutPlan & { plan: WorkoutPlanV2 };
  exercisesById: Map<string, ExerciseCatalogEntry>;
  logs: WorkoutEvidenceLog[];
  online: boolean;
  onSave: (log: WorkoutEvidenceRequest) => Promise<void>;
  locale: Locale;
}) {
  const c = getCopy(locale);
  const [sessionId, setSessionId] = useState(
    activePlan.plan.sessions[0]?.id ?? '',
  );
  const selectedSession = activePlan.plan.sessions.find(
    (session) => session.id === sessionId,
  );
  const prescriptions = useMemo(
    () =>
      selectedSession?.sections.flatMap((section) => section.prescriptions) ??
      [],
    [selectedSession],
  );
  const [results, setResults] = useState<Record<string, ExerciseResultDraft>>(
    () => initialResults(activePlan.plan, sessionId),
  );
  const [duration, setDuration] = useState(
    String(selectedSession?.durationMinutes ?? 20),
  );
  const [rpe, setRpe] = useState(String(selectedSession?.targetRpe ?? 3));
  const [enjoyment, setEnjoyment] = useState('3');
  const [heartRate, setHeartRate] = useState('');
  const [preGlucose, setPreGlucose] = useState('');
  const [postGlucose, setPostGlucose] = useState('');
  const [pain, setPain] = useState(false);
  const [symptoms, setSymptoms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function chooseSession(nextSessionId: string) {
    const session = activePlan.plan.sessions.find(
      (candidate) => candidate.id === nextSessionId,
    );
    setSessionId(nextSessionId);
    setResults(initialResults(activePlan.plan, nextSessionId));
    setDuration(String(session?.durationMinutes ?? 20));
    setRpe(String(session?.targetRpe ?? 3));
  }

  function updateResult(
    exerciseId: string,
    patch: Partial<ExerciseResultDraft>,
  ) {
    setResults((current) => ({
      ...current,
      [exerciseId]: { ...current[exerciseId]!, ...patch },
    }));
  }

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const durationNumber = Number(duration);
    const rpeNumber = Number(rpe);
    const enjoymentNumber = Number(enjoyment);
    const heartRateNumber = heartRate ? Number(heartRate) : undefined;
    if (
      !Number.isInteger(durationNumber) ||
      durationNumber < 1 ||
      !Number.isInteger(rpeNumber) ||
      rpeNumber < 1 ||
      rpeNumber > 10 ||
      !Number.isInteger(enjoymentNumber) ||
      enjoymentNumber < 1 ||
      enjoymentNumber > 5 ||
      (heartRateNumber !== undefined &&
        (!Number.isInteger(heartRateNumber) ||
          heartRateNumber < 20 ||
          heartRateNumber > 260))
    ) {
      setError(c.feedback.workoutLogValidation);
      return;
    }
    const exerciseResults = prescriptions.map((prescription) => {
      const result = results[prescription.exerciseId]!;
      if (result.status === 'skipped')
        return { exerciseId: prescription.exerciseId, status: result.status };
      return {
        exerciseId: prescription.exerciseId,
        status: result.status,
        ...(prescription.sets
          ? {
              actualSets: Number(result.sets),
              actualReps: Number(result.reps),
            }
          : { actualDurationMinutes: Number(result.minutes) }),
        ...(result.load
          ? { actualLoad: Number(result.load), loadUnit: result.loadUnit }
          : {}),
        ...(result.status === 'modified' && result.substitutionId
          ? { substitutionId: result.substitutionId }
          : {}),
      };
    });
    if (
      exerciseResults.some(
        (result) =>
          ('actualSets' in result &&
            (!Number.isInteger(result.actualSets) ||
              !Number.isInteger(result.actualReps) ||
              result.actualSets < 1 ||
              result.actualReps < 1)) ||
          ('actualDurationMinutes' in result &&
            (!Number.isInteger(result.actualDurationMinutes) ||
              result.actualDurationMinutes < 1)) ||
          ('actualLoad' in result &&
            (result.actualLoad === undefined ||
              !Number.isFinite(result.actualLoad) ||
              result.actualLoad <= 0)),
      )
    ) {
      setError(c.feedback.workoutLogValidation);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        idempotencyKey: createDashboardRequestId(),
        planId: activePlan.id,
        sessionId,
        durationMinutes: durationNumber,
        rpe: rpeNumber,
        enjoyment: enjoymentNumber,
        ...(heartRateNumber ? { averageHeartRate: heartRateNumber } : {}),
        pain,
        concerningSymptoms: symptoms,
        ...(preGlucose ? { preGlucose: Number(preGlucose) } : {}),
        ...(postGlucose ? { postGlucose: Number(postGlucose) } : {}),
        exerciseResults,
      });
      setPain(false);
      setSymptoms(false);
      setPreGlucose('');
      setPostGlucose('');
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : c.feedback.workoutLogSaveError,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>{c.workouts.logTitle}</CardTitle>
          <CardDescription>{c.workouts.safetyLogNote}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            <label className="block text-sm font-medium">
              {c.workouts.session}
              <NativeSelect
                className="mt-1 w-full"
                value={sessionId}
                onChange={(event) => chooseSession(event.target.value)}
              >
                {activePlan.plan.sessions.map((session) => (
                  <NativeSelectOption key={session.id} value={session.id}>
                    {session.date} · {c.workouts.purposes[session.purpose]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>

            <fieldset>
              <legend className="font-semibold">
                {c.workouts.exerciseResults}
              </legend>
              <div className="mt-3 space-y-4">
                {prescriptions.map((prescription) => {
                  const result = results[prescription.exerciseId];
                  if (!result) return null;
                  return (
                    <div
                      key={prescription.exerciseId}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <p className="font-medium">
                        {exercisesById.get(prescription.exerciseId)?.name[
                          locale
                        ] ?? prescription.exerciseId}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {prescriptionDose(prescription, locale)}
                      </p>
                      <label className="mt-3 block text-sm font-medium">
                        {c.workouts.resultStatus}
                        <NativeSelect
                          className="mt-1 w-full"
                          value={result.status}
                          onChange={(event) =>
                            updateResult(prescription.exerciseId, {
                              status: event.target
                                .value as ExerciseResultDraft['status'],
                              substitutionId: '',
                            })
                          }
                        >
                          <NativeSelectOption value="completed">
                            {c.workouts.completed}
                          </NativeSelectOption>
                          <NativeSelectOption value="modified">
                            {c.workouts.modified}
                          </NativeSelectOption>
                          <NativeSelectOption value="skipped">
                            {c.workouts.skipped}
                          </NativeSelectOption>
                        </NativeSelect>
                      </label>
                      {result.status !== 'skipped' ? (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {prescription.sets ? (
                            <>
                              <NumberField
                                label={c.workouts.actualSets}
                                value={result.sets}
                                onChange={(sets) =>
                                  updateResult(prescription.exerciseId, {
                                    sets,
                                  })
                                }
                              />
                              <NumberField
                                label={c.workouts.actualReps}
                                value={result.reps}
                                onChange={(reps) =>
                                  updateResult(prescription.exerciseId, {
                                    reps,
                                  })
                                }
                              />
                            </>
                          ) : (
                            <NumberField
                              label={c.workouts.actualMinutes}
                              value={result.minutes}
                              onChange={(minutes) =>
                                updateResult(prescription.exerciseId, {
                                  minutes,
                                })
                              }
                            />
                          )}
                          <NumberField
                            label={c.workouts.load}
                            value={result.load}
                            step="0.1"
                            required={false}
                            onChange={(load) =>
                              updateResult(prescription.exerciseId, { load })
                            }
                          />
                        </div>
                      ) : null}
                      {result.status === 'modified' ? (
                        <label className="mt-3 block text-sm font-medium">
                          {c.workouts.substitution}
                          <NativeSelect
                            className="mt-1 w-full"
                            value={result.substitutionId}
                            onChange={(event) =>
                              updateResult(prescription.exerciseId, {
                                substitutionId: event.target.value,
                              })
                            }
                          >
                            <NativeSelectOption value="">
                              {c.workouts.noSubstitution}
                            </NativeSelectOption>
                            {prescription.substitutionIds.map((id) => (
                              <NativeSelectOption key={id} value={id}>
                                {exercisesById.get(id)?.name[locale] ?? id}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        </label>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <NumberField
                label={c.workouts.duration}
                value={duration}
                onChange={setDuration}
              />
              <NumberField
                label="RPE (1–10)"
                value={rpe}
                min="1"
                max="10"
                onChange={setRpe}
              />
              <NumberField
                label={`${c.workouts.enjoyment} (1–5)`}
                value={enjoyment}
                min="1"
                max="5"
                onChange={setEnjoyment}
              />
              <NumberField
                label={c.workouts.heartRate}
                value={heartRate}
                min="20"
                max="260"
                required={false}
                onChange={setHeartRate}
              />
              <NumberField
                label={c.workouts.preGlucose}
                value={preGlucose}
                step="0.1"
                required={false}
                onChange={setPreGlucose}
              />
              <NumberField
                label={c.workouts.postGlucose}
                value={postGlucose}
                step="0.1"
                required={false}
                onChange={setPostGlucose}
              />
            </div>

            <Alert className="border-rose-200 bg-rose-50 text-rose-950">
              <ShieldAlert />
              <AlertTitle>{c.workouts.stopForSafety}</AlertTitle>
              <AlertDescription className="text-inherit/80">
                {c.workouts.stopForSafetyDescription}
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <CheckField
                checked={pain}
                onChange={setPain}
                label={c.workouts.pain}
              />
              <CheckField
                checked={symptoms}
                onChange={setSymptoms}
                label={c.workouts.concerningSymptoms}
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-rose-700">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={!online || saving}
              className="w-full bg-emerald-800 hover:bg-emerald-900"
            >
              {saving ? <LoaderCircle className="animate-spin" /> : <Check />}{' '}
              {c.workouts.saveLog}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="h-fit border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>{c.workouts.logHistory}</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length ? (
            <ul className="space-y-3">
              {logs.slice(0, 8).map((log) => (
                <li key={log.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{log.sessionId}</span>
                    <Badge
                      variant={log.requiresReview ? 'destructive' : 'outline'}
                    >
                      {log.status === 'stopped_for_safety'
                        ? c.workouts.stopForSafety
                        : c.workouts.completed}
                    </Badge>
                  </div>
                  <p className="mt-1 text-slate-600">
                    {log.durationMinutes} {c.workouts.minutes} · RPE {log.rpe}
                    /10 · {log.exerciseResults.length}{' '}
                    {c.workouts.exerciseResults.toLowerCase()}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">{c.workouts.noLogs}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  required = true,
  min = '1',
  max,
  step = '1',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  min?: string;
  max?: string;
  step?: string;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <Input
        className="mt-1"
        type="number"
        required={required}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function CheckField({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm">
      <input
        type="checkbox"
        className="mt-0.5 size-4 accent-emerald-800"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function RecoveryAndProposal({
  plan,
  checkin,
  proposal,
  exercisesById,
  online,
  onRunCheckin,
  onConfirmProposal,
  onDismissProposal,
  locale,
}: {
  plan: ActiveWorkoutPlan & { plan: WorkoutPlanV2 };
  checkin: WorkoutEvidenceCheckin | null;
  proposal: WorkoutAdaptationProposal | null;
  exercisesById: Map<string, ExerciseCatalogEntry>;
  online: boolean;
  onRunCheckin: Props['onRunCheckin'];
  onConfirmProposal: Props['onConfirmProposal'];
  onDismissProposal: Props['onDismissProposal'];
  locale: Locale;
}) {
  const c = getCopy(locale);
  const [status, setStatus] = useState<WorkoutRecoveryInput['status']>('good');
  const [soreness, setSoreness] = useState(false);
  const [pain, setPain] = useState(false);
  const [busy, setBusy] = useState<'checkin' | 'confirm' | 'dismiss' | null>(
    null,
  );
  const [error, setError] = useState('');

  async function act(
    kind: 'checkin' | 'confirm' | 'dismiss',
    action: () => Promise<void>,
  ) {
    setBusy(kind);
    setError('');
    try {
      await action();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : c.feedback.checkinError,
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>{c.workouts.recoveryTitle}</CardTitle>
          <CardDescription>{c.workouts.recoveryDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <fieldset>
            <legend className="text-sm font-medium">
              {c.workouts.recoveryStatus}
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {(
                [
                  ['good', c.workouts.recoveryGood],
                  ['some_fatigue', c.workouts.recoveryFatigue],
                  ['poor', c.workouts.recoveryPoor],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm"
                >
                  <input
                    type="radio"
                    name="recovery-status"
                    value={value}
                    checked={status === value}
                    onChange={() => setStatus(value)}
                    className="accent-emerald-800"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <CheckField
            checked={soreness}
            onChange={setSoreness}
            label={c.workouts.soreness}
          />
          <CheckField
            checked={pain}
            onChange={setPain}
            label={c.workouts.recoveryPain}
          />
          {checkin?.recovery ? (
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              {c.workouts.checkinTitle}:{' '}
              {checkin.recovery.status.replaceAll('_', ' ')}
            </p>
          ) : null}
          <Button
            type="button"
            disabled={!online || busy !== null}
            className="w-full bg-emerald-800 hover:bg-emerald-900"
            onClick={() =>
              void act('checkin', () =>
                onRunCheckin(plan.id, { status, soreness, pain }),
              )
            }
          >
            {busy === 'checkin' ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <RefreshCw />
            )}{' '}
            {c.workouts.createProposal}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>{c.workouts.proposalTitle}</CardTitle>
          <CardDescription>
            {proposal
              ? `${c.workouts.actions[proposal.action]} · ${c.workouts.proposalStatuses[proposal.status]}`
              : c.workouts.noChange}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4" aria-live="polite">
          {proposal ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {c.workouts.confidence}: {proposal.confidence}
                </Badge>
                <Badge variant="outline">
                  {c.workouts.completeness}: {proposal.dataCompleteness}
                </Badge>
                <Badge variant="outline">
                  {c.workouts.evidence}: {proposal.evidenceRecordIds.length}
                </Badge>
              </div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                {proposal.reasonCodes.map((reason) => (
                  <li key={reason}>{copyKeyText(reason, locale)}</li>
                ))}
                {proposal.unresolvedQuestions.map((question) => (
                  <li
                    key={`${question.code}:${question.exerciseIds.join('-')}`}
                  >
                    {copyKeyText(question.code, locale)}
                  </li>
                ))}
              </ul>
              <ul className="space-y-3">
                {proposal.changes.map((change) => (
                  <li
                    key={`${change.sessionId}:${change.exerciseId}`}
                    className="rounded-xl border border-slate-200 p-3 text-sm"
                  >
                    <p className="font-medium">
                      {exercisesById.get(change.exerciseId)?.name[locale] ??
                        change.exerciseId}
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg bg-slate-50 p-2">
                        <span className="text-xs font-medium uppercase text-slate-500">
                          {c.workouts.before}
                        </span>
                        <p className="mt-1">
                          {prescriptionDose(change.before, locale)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-emerald-50 p-2">
                        <span className="text-xs font-medium uppercase text-emerald-700">
                          {c.workouts.after}
                        </span>
                        <p className="mt-1">
                          {change.after
                            ? prescriptionDose(change.after, locale)
                            : c.workouts.skipped}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {copyKeyText(change.reasonCode, locale)}
                    </p>
                  </li>
                ))}
              </ul>
              {!proposal.changes.length ? (
                <p className="text-sm text-slate-600">{c.workouts.noChange}</p>
              ) : null}
              {proposal.action === 'hold_for_review' ? (
                <Alert variant="destructive">
                  <ShieldAlert />
                  <AlertTitle>{c.workouts.stopForSafety}</AlertTitle>
                  <AlertDescription>{c.workouts.proposalHeld}</AlertDescription>
                </Alert>
              ) : null}
              {proposal.status === 'pending' ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {proposal.action !== 'hold_for_review' ? (
                    <Button
                      type="button"
                      disabled={!online || busy !== null}
                      className="bg-emerald-800 hover:bg-emerald-900"
                      onClick={() =>
                        void act('confirm', () =>
                          onConfirmProposal(proposal.id),
                        )
                      }
                    >
                      {busy === 'confirm' ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <Check />
                      )}{' '}
                      {c.workouts.confirmProposal}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!online || busy !== null}
                    onClick={() =>
                      void act('dismiss', () => onDismissProposal(proposal.id))
                    }
                  >
                    {busy === 'dismiss' ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <X />
                    )}{' '}
                    {c.workouts.dismissProposal}
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-slate-500">
              {c.workouts.recoveryDescription}
            </p>
          )}
          {error ? (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export function WorkoutPlanWorkspace(props: Props) {
  const {
    exercises,
    confirmedPlan,
    logs,
    checkin,
    proposal,
    online,
    onPreview,
    onConfirmPlan,
    onSaveLog,
    onRunCheckin,
    onConfirmProposal,
    onDismissProposal,
    locale,
  } = props;
  const c = getCopy(locale);
  const exercisesById = useMemo(
    () => new Map(exercises.map((exercise) => [exercise.id, exercise])),
    [exercises],
  );
  const [preview, setPreview] = useState<WorkoutPlanPreviewResponse | null>(
    null,
  );
  const [previewIsExpired, setPreviewIsExpired] = useState(false);
  const [busy, setBusy] = useState<'preview' | 'confirm' | null>(null);
  const [error, setError] = useState('');

  async function generatePreview() {
    setBusy('preview');
    setError('');
    try {
      const nextPreview = await onPreview();
      setPreviewIsExpired(false);
      setPreview(nextPreview);
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : c.feedback.planPreviewError,
      );
    } finally {
      setBusy(null);
    }
  }

  async function confirmPreview() {
    if (!preview) return;
    setBusy('confirm');
    setError('');
    try {
      await onConfirmPlan(preview.previewId);
      setPreview(null);
    } catch (confirmationError) {
      setError(
        confirmationError instanceof Error
          ? confirmationError.message
          : c.feedback.planConfirmError,
      );
    } finally {
      setBusy(null);
    }
  }

  const activeV2 =
    confirmedPlan?.plan.planVersion === 'workout-plan-v2'
      ? (confirmedPlan as ActiveWorkoutPlan & { plan: WorkoutPlanV2 })
      : null;
  useEffect(() => {
    if (!preview) return;
    const timer = window.setTimeout(
      () => setPreviewIsExpired(true),
      workoutPreviewExpiryDelay(preview.expiresAt),
    );
    return () => window.clearTimeout(timer);
  }, [preview]);

  return (
    <section className="space-y-8" aria-labelledby="workout-workspace-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-emerald-800">
            {c.workouts.activePlan}
          </p>
          <h2
            id="workout-workspace-title"
            className="mt-1 text-2xl font-semibold tracking-tight"
          >
            {c.workouts.workspaceTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {c.workouts.workspaceDescription}
          </p>
        </div>
        <Button
          type="button"
          disabled={!online || busy !== null}
          onClick={() => void generatePreview()}
          className="bg-emerald-800 hover:bg-emerald-900"
        >
          {busy === 'preview' ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <ClipboardCheck />
          )}{' '}
          {confirmedPlan ? c.workouts.replacePlan : c.workouts.previewPlan}
        </Button>
      </div>

      {!online ? (
        <Alert className="border-amber-300 bg-amber-50 text-amber-950">
          <WifiOff />
          <AlertTitle>{c.workouts.offlineTitle}</AlertTitle>
          <AlertDescription className="text-inherit/80">
            {c.workouts.offlineDescription}
          </AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800"
        >
          {error}
        </p>
      ) : null}

      {preview ? (
        <Card className="border-emerald-300 shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardDescription>{c.workouts.draftPlan}</CardDescription>
                <CardTitle className="mt-1">
                  {c.workouts.workspaceTitle}
                </CardTitle>
              </div>
              <Badge variant="outline">
                {c.workouts.previewExpires}:{' '}
                {new Date(preview.expiresAt).toLocaleString(
                  locale === 'vi' ? 'vi-VN' : 'en-US',
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <PlanDetails
              plan={preview.plan}
              exercisesById={exercisesById}
              locale={locale}
            />
            {previewIsExpired ? (
              <p role="alert" className="text-sm text-rose-700">
                {c.workouts.previewExpired}
              </p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                disabled={
                  !online ||
                  busy !== null ||
                  previewIsExpired ||
                  preview.plan.draftStatus === 'incomplete'
                }
                className="bg-emerald-800 hover:bg-emerald-900"
                onClick={() => void confirmPreview()}
              >
                {busy === 'confirm' ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <Check />
                )}{' '}
                {c.workouts.confirmPlan}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                onClick={() => setPreview(null)}
              >
                <X /> {c.workouts.discardPreview}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeV2 ? (
        <>
          <PlanDetails
            plan={activeV2.plan}
            exercisesById={exercisesById}
            locale={locale}
          />
          <ExerciseLogForm
            key={`log-${activeV2.id}`}
            activePlan={activeV2}
            exercisesById={exercisesById}
            logs={logs}
            online={online}
            onSave={onSaveLog}
            locale={locale}
          />
          <RecoveryAndProposal
            key={`recovery-${activeV2.id}`}
            plan={activeV2}
            checkin={checkin}
            proposal={proposal}
            exercisesById={exercisesById}
            online={online}
            onRunCheckin={onRunCheckin}
            onConfirmProposal={onConfirmProposal}
            onDismissProposal={onDismissProposal}
            locale={locale}
          />
        </>
      ) : confirmedPlan ? (
        <Alert>
          <Dumbbell />
          <AlertTitle>{c.workouts.planTitle}</AlertTitle>
          <AlertDescription>{c.workouts.legacyPlan}</AlertDescription>
        </Alert>
      ) : !preview ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          {c.workouts.noActivePlan}
        </p>
      ) : null}
    </section>
  );
}
