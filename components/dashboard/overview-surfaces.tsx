import {
  Activity,
  ShieldAlert,
  Flame,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Utensils,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type {
  Analytics,
  EffectiveSafetyContext,
  HealthFocus,
  Reminder,
} from '@/lib/contracts';
import {
  createDailyCoachGuidance,
  type CoachPriority,
} from '@/lib/coach-guidance';
import {
  dashboardTargets,
  type DashboardMeal,
  type DashboardTargetKey,
} from '@/lib/dashboard-model';
import { getCopy, type Locale } from '@/lib/copy';
import type { ActiveWorkoutPlan } from '@/lib/workout-plan-lifecycle';

type Totals = Record<DashboardTargetKey, number>;

export function CoachSurface({
  totals,
  targets,
  healthFocuses,
  workoutPlan,
  safetyContext,
  locale,
}: {
  totals: Totals;
  targets: Totals;
  healthFocuses: HealthFocus[];
  workoutPlan: ActiveWorkoutPlan | null;
  safetyContext: EffectiveSafetyContext | null;
  locale: Locale;
}) {
  const c = getCopy(locale);
  const guidance = createDailyCoachGuidance(
    totals,
    targets,
    healthFocuses.length,
  );
  const priorityCopy: Record<CoachPriority, string> = {
    protein: c.coach.priorities.protein,
    fiber: c.coach.priorities.fiber,
    sodium: c.coach.priorities.sodium,
    health_focus: c.coach.priorities.healthFocus,
    balanced: c.coach.priorities.balanced,
  };
  const exerciseDecision = safetyContext?.decisions.coach_exercise;
  const safetyReasons = c.safetyContext.reasons as Record<string, string>;
  return (
    <section className="mx-auto max-w-4xl">
      <p className="text-sm font-medium text-slate-500">
        {c.coach.eyebrow} · {c.common.private}
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
        {c.coach.title}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        {c.coach.description}
      </p>
      <Card className="mt-7 border-emerald-100 bg-emerald-50/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-emerald-800" />
            {c.coach.boundaryTitle}
          </CardTitle>
          <CardDescription>{c.coach.boundaryDescription}</CardDescription>
        </CardHeader>
      </Card>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dashboardTargets.map((target) => (
          <Card key={target.key} className="border-none shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>{c.coach.remaining}</CardDescription>
              <CardTitle>
                {guidance.remaining[target.key].toLocaleString(locale)}{' '}
                {target.unit}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-500">
              {target.key === 'calories'
                ? c.today.calories
                : target.key === 'protein'
                  ? c.today.protein
                  : target.key === 'fiber'
                    ? c.today.fiber
                    : c.today.sodium}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>{c.coach.prioritiesTitle}</CardTitle>
            <CardDescription>{c.coach.prioritiesDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {guidance.priorities.map((priority) => (
              <div
                key={priority}
                className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm leading-6 text-slate-700"
              >
                {priorityCopy[priority]}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>{c.coach.planTitle}</CardTitle>
            <CardDescription>{c.coach.planDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {exerciseDecision?.status === 'blocked' ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
                <p className="flex items-center gap-2 font-semibold"><ShieldAlert className="size-4" />{c.safetyContext.blocked}</p>
                <ul className="mt-2 list-disc pl-5">{exerciseDecision.reasons.map((reason) => <li key={reason.code}>{safetyReasons[reason.code]}</li>)}</ul>
              </div>
            ) : workoutPlan?.plan.sessions?.length ? (
              <p className="text-sm leading-6 text-slate-700">
                {c.coach.planAvailable.replace(
                  '{count}',
                  String(workoutPlan.plan.sessions.length),
                )}
              </p>
            ) : (
              <p className="text-sm leading-6 text-slate-500">
                {c.coach.noPlan}
              </p>
            )}
            {exerciseDecision?.status === 'allowed_with_modifications' ? <ul className="mt-3 list-disc pl-5 text-sm leading-6 text-sky-900">{exerciseDecision.reasons.map((reason) => <li key={reason.code}>{safetyReasons[reason.code]}</li>)}</ul> : null}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

export function ProgressSurface({
  analytics,
  locale,
}: {
  analytics: Analytics | null;
  locale: Locale;
}) {
  const c = getCopy(locale);
  if (!analytics)
    return (
      <section className="mx-auto max-w-3xl">
        <p className="text-sm text-slate-600">{c.common.loading}</p>
      </section>
    );
  const latestNutrition = analytics.dailyNutrition.at(-1);
  return (
    <section className="mx-auto max-w-4xl">
      <p className="text-sm font-medium text-slate-500">
        {c.progress.eyebrow} · {c.common.private}
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
        {c.progress.title}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        {c.progress.description}
      </p>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label={c.progress.coverage}
          value={`${analytics.completeness.coveragePercent}%`}
          detail={`${analytics.completeness.observedDays}/${analytics.periodDays} ${c.progress.daysWithData}`}
        />
        <Metric
          label={c.progress.completedWorkouts}
          value={String(analytics.workout.completedSessions)}
          detail={`${analytics.workout.totalMinutes} ${c.workouts.minutes}`}
        />
        <Metric
          label={c.progress.safetyStopped}
          value={String(analytics.workout.stoppedForSafety)}
          detail={c.progress.safetyStoppedNote}
        />
        <Metric
          label={c.progress.latestNutrition}
          value={latestNutrition ? `${latestNutrition.calories} kcal` : '—'}
          detail={
            latestNutrition
              ? `${latestNutrition.mealCount} ${c.progress.meals}`
              : c.progress.noNutrition
          }
        />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>{c.progress.nutritionDays}</CardTitle>
            <CardDescription>
              {c.progress.nutritionDaysDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.dailyNutrition.length ? (
              <div className="space-y-3">
                {analytics.dailyNutrition
                  .slice(-7)
                  .reverse()
                  .map((day) => (
                    <div
                      key={day.date}
                      className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm"
                    >
                      <span>{day.date}</span>
                      <span className="text-slate-600">
                        {day.calories} kcal · {day.protein} g {c.today.protein}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">{c.progress.noNutrition}</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>{c.progress.measurementTrends}</CardTitle>
            <CardDescription>{c.progress.trendWarning}</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.measurementTrends.length ? (
              <div className="space-y-3">
                {analytics.measurementTrends.map((trend) => (
                  <div
                    key={trend.metric}
                    className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm"
                  >
                    <span>{trend.metric.replaceAll('_', ' ')}</span>
                    <span className="text-right text-slate-600">
                      {trend.lastValue} {trend.unit}
                      <br />
                      <span className="text-xs">
                        {trend.change >= 0 ? '+' : ''}
                        {trend.change.toFixed(1)} · n={trend.sampleSize}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                {c.progress.noMeasurements}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle>{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-slate-500">{detail}</CardContent>
    </Card>
  );
}

export function TodaySurface({
  meals,
  totals,
  targets,
  reminders,
  loading,
  onCapture,
  locale,
}: {
  meals: DashboardMeal[];
  totals: Totals;
  targets: Totals;
  reminders: Reminder[];
  loading: boolean;
  onCapture: () => void;
  locale: Locale;
}) {
  const c = getCopy(locale);
  const labels: Record<DashboardTargetKey, string> = {
    calories: c.today.calories,
    protein: c.today.protein,
    fiber: c.today.fiber,
    sodium: c.today.sodium,
  };
  const reminderLabels: Record<Reminder['kind'], string> = {
    meal: c.reminders.meal,
    workout: c.reminders.workout,
    measurement: c.reminders.measurement,
    weekly_review: c.reminders.weeklyReview,
  };
  const upcoming = reminders
    .filter((reminder) => reminder.status === 'active')
    .sort(
      (left, right) =>
        new Date(left.nextDeliveryAt).getTime() -
        new Date(right.nextDeliveryAt).getTime(),
    )
    .slice(0, 3);
  return (
    <>
      <section className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {c.today.confirmedOnly}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            {c.today.title}
          </h1>
        </div>
        <Button
          className="bg-emerald-800 hover:bg-emerald-900"
          onClick={onCapture}
        >
          <Plus /> {c.today.logMeal}
        </Button>
      </section>
      <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dashboardTargets.map((target) => {
          const actual = totals[target.key];
          const targetValue = targets[target.key];
          const hasTarget = targetValue > 0;
          const remaining = hasTarget ? Math.max(0, targetValue - actual) : 0;
          return (
            <Card key={target.key} className="border-none shadow-sm">
              <CardContent className="pt-5">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-600">
                    {labels[target.key]}
                  </p>
                  <span className={`size-2.5 rounded-full ${target.color}`} />
                </div>
                <p className="mt-5 text-2xl font-semibold">
                  {actual.toLocaleString(locale)}{' '}
                  <span className="text-sm font-medium text-slate-400">
                    / {targetValue.toLocaleString(locale)} {target.unit}
                  </span>
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {hasTarget
                    ? `${remaining.toLocaleString(locale)} ${target.unit} ${c.today.remaining}`
                    : c.today.noTarget}
                </p>
                <Progress
                  value={
                    hasTarget
                      ? Math.min(100, Math.round((actual / targetValue) * 100))
                      : 0
                  }
                  className="mt-4 [&_[data-slot=progress-indicator]]:bg-emerald-700"
                />
              </CardContent>
            </Card>
          );
        })}
      </section>
      <section className="mt-7 grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <div>
              <CardDescription>{c.today.mealLog}</CardDescription>
              <CardTitle className="mt-1">{c.today.confirmedEntries}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
                <LoaderCircle className="size-4 animate-spin" />{' '}
                {c.today.loadingRecords}
              </div>
            ) : meals.length === 0 ? (
              <EmptyMeals onCapture={onCapture} locale={locale} />
            ) : (
              <div className="space-y-3">
                {meals.map((meal) => (
                  <div
                    key={meal.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"
                  >
                    <div className="grid size-10 place-items-center rounded-xl bg-orange-50 text-orange-600">
                      <Utensils className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{meal.name}</p>
                      <p className="text-xs text-slate-500">
                        {new Intl.DateTimeFormat(
                          locale === 'vi' ? 'vi-VN' : 'en-GB',
                          { hour: '2-digit', minute: '2-digit' },
                        ).format(new Date(meal.occurredAt))}{' '}
                        · {meal.nutritionSnapshot.totals.calories} kcal ·{' '}
                        {meal.nutritionSnapshot.source.replace('_', ' ')}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${meal.confidence < 70 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}
                    >
                      {meal.confidence}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <div className="space-y-5">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardDescription>{c.today.agenda}</CardDescription>
              <CardTitle>{c.today.upcoming}</CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length ? (
                <div className="space-y-3">
                  {upcoming.map((reminder) => (
                    <div
                      key={reminder.id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="font-medium">
                        {reminderLabels[reminder.kind]}
                      </span>
                      <span className="text-right text-slate-500">
                        {new Intl.DateTimeFormat(
                          locale === 'vi' ? 'vi-VN' : 'en-GB',
                          {
                            weekday: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Asia/Bangkok',
                          },
                        ).format(new Date(reminder.nextDeliveryAt))}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">{c.today.noAgenda}</p>
              )}
            </CardContent>
          </Card>
          <Card className="border-none bg-[#163e32] text-white shadow-sm">
            <CardContent className="pt-5">
              <ShieldCheck className="size-6 text-emerald-300" />
              <p className="mt-4 text-lg font-semibold">
                {c.today.evidenceTitle}
              </p>
              <p className="mt-2 text-sm leading-6 text-emerald-50/80">
                {c.today.evidenceDescription}
              </p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="pt-5">
              <Activity className="size-5 text-emerald-700" />
              <p className="mt-3 font-semibold">{c.today.guidanceTitle}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {c.today.guidanceDescription}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}

function EmptyMeals({
  onCapture,
  locale,
}: {
  onCapture: () => void;
  locale: Locale;
}) {
  const c = getCopy(locale);
  return (
    <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
      <div>
        <Flame className="mx-auto size-7 text-orange-400" />
        <p className="mt-3 font-semibold">{c.today.emptyTitle}</p>
        <p className="mt-1 text-sm leading-5 text-slate-500">
          {c.today.emptyDescription}
        </p>
        <Button variant="outline" className="mt-4" onClick={onCapture}>
          {c.today.captureMeal}
        </Button>
      </div>
    </div>
  );
}
