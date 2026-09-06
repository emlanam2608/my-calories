'use client';

import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import type {
  FoodAnalysis,
  EffectiveSafetyContext,
  HealthFocus,
  Measurement,
  OnboardingDraft,
  SensitiveNotes,
  WorkoutReadiness,
  WorkoutPlanResponse,
  WorkoutLog,
  WorkoutCheckin,
  Analytics,
  SavedFood,
  Reminder,
} from '@/lib/contracts';
import { getCopy, type Locale } from '@/lib/copy';
import {
  CoachSurface,
  ProgressSurface,
  TodaySurface,
} from '@/components/dashboard/overview-surfaces';
import { DashboardNotice } from '@/components/dashboard/notice';
import { SettingsSurface } from '@/components/dashboard/settings-surface';
import { CaptureSurface } from '@/components/dashboard/capture-surface';
import { MeasurementsSurface } from '@/components/dashboard/measurements-surface';
import { WorkoutReadinessSurface } from '@/components/dashboard/workout-readiness-surface';
import {
  useDashboardEffects,
  useOnlineStatus,
} from '@/components/dashboard/use-dashboard-effects';
import { useReminderActions } from '@/components/dashboard/use-reminder-actions';
import { useMeasurementActions } from '@/components/dashboard/use-measurement-actions';
import { useWorkoutActions } from '@/components/dashboard/use-workout-actions';
import { useProfileActions } from '@/components/dashboard/use-profile-actions';
import { useCaptureActions } from '@/components/dashboard/use-capture-actions';
import { useDashboardQuery } from '@/components/dashboard/use-dashboard-query';
import {
  type DashboardMeal as Meal,
  type DashboardTargetKey as TargetKey,
} from '@/lib/dashboard-model';
import type { ExerciseCatalogEntry } from '@/lib/exercise-catalog';
import type { DashboardBootstrap } from '@/lib/dashboard-bootstrap';
import { defaultEffectiveTargets, type EffectiveTarget } from '@/lib/targets';

export function Dashboard({ displayName }: { displayName: string }) {
  const [locale, setLocale] = useState<Locale>('en');
  const [page, setPage] = useState<
    | 'today'
    | 'capture'
    | 'coach'
    | 'measurements'
    | 'workouts'
    | 'progress'
    | 'settings'
  >('today');
  const [meals, setMeals] = useState<Meal[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [workoutReadiness, setWorkoutReadiness] =
    useState<WorkoutReadiness | null>(null);
  const [safetyContext, setSafetyContext] =
    useState<EffectiveSafetyContext | null>(null);
  const [exercises, setExercises] = useState<ExerciseCatalogEntry[]>([]);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlanResponse | null>(
    null,
  );
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [workoutCheckin, setWorkoutCheckin] = useState<WorkoutCheckin | null>(
    null,
  );
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [savedFoods, setSavedFoods] = useState<SavedFood[]>([]);
  const [deletingSavedFoodId, setDeletingSavedFoodId] = useState<string | null>(
    null,
  );
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [targetValues, setTargetValues] = useState<Record<TargetKey, number>>({
    calories: 1850,
    protein: 90,
    fiber: 28,
    sodium: 2000,
  });
  const [effectiveTargets, setEffectiveTargets] = useState<EffectiveTarget[]>(
    defaultEffectiveTargets,
  );
  const [healthFocuses, setHealthFocuses] = useState<HealthFocus[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingDraft>({});
  const [onboardingStatus, setOnboardingStatus] = useState<
    'in_progress' | 'complete'
  >('in_progress');
  const [sensitiveNotes, setSensitiveNotes] = useState<SensitiveNotes>({
    medicationNote: '',
    clinicianNote: '',
    symptomNote: '',
  });
  const [sensitiveNotesAvailable, setSensitiveNotesAvailable] = useState(true);
  const [draft, setDraft] = useState('');
  const [captureMode, setCaptureMode] = useState<
    'text' | 'barcode' | 'vietnam_database' | 'usda' | 'photo'
  >('text');
  const [vietnamCatalog, setVietnamCatalog] = useState<'ingredient' | 'dish'>(
    'dish',
  );
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPersonalFood, setSavingPersonalFood] = useState(false);
  const [savingTargets, setSavingTargets] = useState(false);
  const [savingFocuses, setSavingFocuses] = useState(false);
  const [savingOnboarding, setSavingOnboarding] = useState(false);
  const [savingSensitiveNotes, setSavingSensitiveNotes] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const c = getCopy(locale);
  const online = useOnlineStatus();
  const { createReminder, actOnReminder } = useReminderActions(
    locale,
    setReminders,
    setNotice,
  );

  const applyDashboardData = useCallback((data: DashboardBootstrap) => {
    setMeals(data.meals);
    if (data.locale) setLocale(data.locale);
    if (data.targets) {
      setEffectiveTargets(data.targets);
      setTargetValues((current) => ({
        ...current,
        ...Object.fromEntries(
          data.targets!.map((target) => [target.metric, target.value]),
        ),
      }));
    }
    if (data.focuses) setHealthFocuses(data.focuses);
    if (data.onboarding) {
      setOnboarding(data.onboarding.draft);
      setOnboardingStatus(data.onboarding.status);
    }
    setSensitiveNotesAvailable(data.sensitiveNotesAvailable);
    if (data.sensitiveNotes) setSensitiveNotes(data.sensitiveNotes);
    if (data.measurements) setMeasurements(data.measurements);
    if (data.readiness) setWorkoutReadiness(data.readiness);
    if (data.safetyContext) setSafetyContext(data.safetyContext);
    if (data.exercises) setExercises(data.exercises);
    if (data.plan !== undefined) setWorkoutPlan(data.plan);
    if (data.logs) setWorkoutLogs(data.logs);
    if (data.checkin !== undefined) setWorkoutCheckin(data.checkin);
    if (data.analytics) setAnalytics(data.analytics);
    if (data.savedFoods) setSavedFoods(data.savedFoods);
    if (data.reminders) setReminders(data.reminders);
  }, []);
  const {
    loading,
    loadFailure,
    reload: loadMeals,
  } = useDashboardQuery(locale, online, applyDashboardData);
  useDashboardEffects(locale);
  const resetAccountState = useCallback(() => {
    setMeals([]);
    setMeasurements([]);
    setWorkoutReadiness(null);
    setSafetyContext(null);
    setExercises([]);
    setWorkoutPlan(null);
    setWorkoutLogs([]);
    setWorkoutCheckin(null);
    setAnalytics(null);
    setSavedFoods([]);
    setReminders([]);
    setHealthFocuses([]);
    setEffectiveTargets(defaultEffectiveTargets);
    setOnboarding({});
    setOnboardingStatus('in_progress');
    setSensitiveNotes({
      medicationNote: '',
      clinicianNote: '',
      symptomNote: '',
    });
    setPage('today');
  }, []);
  const {
    saveTargets,
    saveHealthFocuses,
    saveOnboarding,
    saveSensitiveNotes,
    changeLocale,
    deleteAccountData,
  } = useProfileActions({
    locale,
    setLocale,
    setTargets: setTargetValues,
    setHealthFocuses,
    setOnboarding,
    setOnboardingStatus,
    setSensitiveNotes,
    setSavingTargets,
    setSavingFocuses,
    setSavingOnboarding,
    setSavingSensitiveNotes,
    setError,
    setNotice,
    onTargetsSaved: () => setPage('today'),
    resetAccountState,
    reload: loadMeals,
  });
  const { saveMeasurement, deleteMeasurementSourceImage } =
    useMeasurementActions({
      locale,
      reload: loadMeals,
      setError,
      setNotice,
    });
  const {
    saveWorkoutReadiness,
    previewWorkoutPlan,
    confirmWorkoutPlan,
    saveWorkoutLog,
    runWorkoutCheckin,
  } = useWorkoutActions({
    locale,
    setReadiness: setWorkoutReadiness,
    setPlan: setWorkoutPlan,
    setLogs: setWorkoutLogs,
    setCheckin: setWorkoutCheckin,
    setError,
    setNotice,
    reload: loadMeals,
  });
  const {
    analyseMeal,
    updateAnalysis,
    updateAnalysisDetails,
    refreshMealReview,
    confirmMeal,
    savePersonalFood,
    reviewSavedFood,
    deleteSavedFood,
  } = useCaptureActions({
    locale,
    captureMode,
    vietnamCatalog,
    draft,
    analysis,
    healthFocuses,
    effectiveTargets,
    reload: loadMeals,
    setPage,
    setDraft,
    setCaptureMode,
    setAnalysis,
    setSavedFoods,
    setDeletingSavedFoodId,
    setAnalysing,
    setSaving,
    setSavingPersonalFood,
    setError,
    setNotice,
  });

  const totals = useMemo(
    () =>
      meals.reduce(
        (sum, meal) => ({
          calories: sum.calories + meal.nutritionSnapshot.totals.calories,
          protein: sum.protein + meal.nutritionSnapshot.totals.protein,
          fiber: sum.fiber + meal.nutritionSnapshot.totals.fiber,
          sodium: sum.sodium + meal.nutritionSnapshot.totals.sodium,
        }),
        { calories: 0, protein: 0, fiber: 0, sodium: 0 },
      ),
    [meals],
  );

  const today = new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Bangkok',
  }).format(new Date());

  return (
    <main
      aria-busy={loading}
      className="min-h-screen bg-[#f4f8f5] text-slate-900"
    >
      <header className="sticky top-0 z-20 border-b border-emerald-950/10 bg-[#f4f8f5]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
              {c.app.name}
            </p>
            <p className="mt-1 text-sm text-slate-500">{c.app.tagline}</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="sr-only" htmlFor="locale">
              {c.app.changeLanguage}
            </label>
            <select
              id="locale"
              value={locale}
              onChange={(event) =>
                void changeLocale(event.target.value as Locale)
              }
              className="h-9 rounded-lg border border-emerald-900/15 bg-white px-2 text-sm"
              aria-label={c.app.changeLanguage}
            >
              <option value="en">EN</option>
              <option value="vi">VI</option>
            </select>
            <div className="text-right">
              <p className="text-sm font-semibold">{displayName}</p>
              <p className="text-xs text-slate-500">{today}</p>
            </div>
          </div>
        </div>
        <nav
          className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6"
          aria-label={c.nav.openNavigation}
        >
          <Button
            aria-current={page === 'today' ? 'page' : undefined}
            variant={page === 'today' ? 'default' : 'ghost'}
            className={
              page === 'today' ? 'bg-emerald-800 hover:bg-emerald-900' : ''
            }
            onClick={() => setPage('today')}
          >
            {c.nav.today}
          </Button>
          <Button
            aria-current={page === 'capture' ? 'page' : undefined}
            variant={page === 'capture' ? 'default' : 'ghost'}
            className={
              page === 'capture' ? 'bg-emerald-800 hover:bg-emerald-900' : ''
            }
            onClick={() => setPage('capture')}
          >
            {c.nav.capture}
          </Button>
          <Button
            aria-current={page === 'coach' ? 'page' : undefined}
            variant={page === 'coach' ? 'default' : 'ghost'}
            className={
              page === 'coach' ? 'bg-emerald-800 hover:bg-emerald-900' : ''
            }
            onClick={() => setPage('coach')}
          >
            {c.nav.coach}
          </Button>
          <Button
            aria-current={page === 'measurements' ? 'page' : undefined}
            variant={page === 'measurements' ? 'default' : 'ghost'}
            className={
              page === 'measurements'
                ? 'bg-emerald-800 hover:bg-emerald-900'
                : ''
            }
            onClick={() => setPage('measurements')}
          >
            {c.nav.measurements}
          </Button>
          <Button
            aria-current={page === 'workouts' ? 'page' : undefined}
            variant={page === 'workouts' ? 'default' : 'ghost'}
            className={
              page === 'workouts' ? 'bg-emerald-800 hover:bg-emerald-900' : ''
            }
            onClick={() => setPage('workouts')}
          >
            {c.nav.workouts}
          </Button>
          <Button
            aria-current={page === 'progress' ? 'page' : undefined}
            variant={page === 'progress' ? 'default' : 'ghost'}
            className={
              page === 'progress' ? 'bg-emerald-800 hover:bg-emerald-900' : ''
            }
            onClick={() => setPage('progress')}
          >
            {c.nav.progress}
          </Button>
          <Button
            aria-current={page === 'settings' ? 'page' : undefined}
            variant={page === 'settings' ? 'default' : 'ghost'}
            className={
              page === 'settings' ? 'bg-emerald-800 hover:bg-emerald-900' : ''
            }
            onClick={() => setPage('settings')}
          >
            {c.nav.settings}
          </Button>
        </nav>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-7 pb-16 sm:px-6">
        {notice ? <DashboardNotice tone="success" text={notice} /> : null}
        {error ? <DashboardNotice tone="error" text={error} /> : null}
        {loadFailure ? (
          <DashboardNotice
            tone="error"
            text={loadFailure}
            action={{
              label: c.feedback.dashboardRetry,
              onClick: () => void loadMeals(),
              disabled: !online || loading,
            }}
          />
        ) : null}
        <fieldset
          disabled={!online}
          aria-disabled={!online}
          className="min-w-0 border-0 p-0"
        >
          {page === 'today' ? (
            <TodaySurface
              meals={meals}
              totals={totals}
              targets={targetValues}
              reminders={reminders}
              loading={loading}
              onCapture={() => setPage('capture')}
              locale={locale}
            />
          ) : page === 'capture' ? (
            <CaptureSurface
              captureMode={captureMode}
              setCaptureMode={setCaptureMode}
              vietnamCatalog={vietnamCatalog}
              setVietnamCatalog={setVietnamCatalog}
              draft={draft}
              setDraft={setDraft}
              analysis={analysis}
              analysing={analysing}
              saving={saving}
              savingPersonalFood={savingPersonalFood}
              onAnalyse={analyseMeal}
              onNutrientChange={updateAnalysis}
              onReviewDetailsChange={updateAnalysisDetails}
              onRefreshReview={refreshMealReview}
              onDiscard={() => setAnalysis(null)}
              onConfirm={confirmMeal}
              onSavePersonalFood={savePersonalFood}
              savedFoods={savedFoods}
              onUseSavedFood={reviewSavedFood}
              onDeleteSavedFood={deleteSavedFood}
              deletingSavedFoodId={deletingSavedFoodId}
              locale={locale}
            />
          ) : page === 'coach' ? (
            <CoachSurface
              totals={totals}
              targets={targetValues}
              healthFocuses={healthFocuses}
              workoutPlan={workoutPlan}
              safetyContext={safetyContext}
              locale={locale}
            />
          ) : page === 'measurements' ? (
            <MeasurementsSurface
              entries={measurements}
              onSave={saveMeasurement}
              onDeleteSourceImage={deleteMeasurementSourceImage}
              locale={locale}
            />
          ) : page === 'workouts' ? (
            <WorkoutReadinessSurface
              readiness={workoutReadiness}
              safetyContext={safetyContext}
              exercises={exercises}
              confirmedPlan={workoutPlan}
              logs={workoutLogs}
              checkin={workoutCheckin}
              onSave={saveWorkoutReadiness}
              onPreview={previewWorkoutPlan}
              onConfirmPlan={confirmWorkoutPlan}
              onSaveLog={saveWorkoutLog}
              onRunCheckin={runWorkoutCheckin}
              locale={locale}
            />
          ) : page === 'progress' ? (
            <ProgressSurface analytics={analytics} locale={locale} />
          ) : (
            <SettingsSurface
              key={JSON.stringify({
                targetValues,
                healthFocuses,
                onboarding,
                sensitiveNotes,
              })}
              targets={targetValues}
              saving={savingTargets}
              onSave={saveTargets}
              healthFocuses={healthFocuses}
              savingFocuses={savingFocuses}
              onSaveFocuses={saveHealthFocuses}
              onboarding={onboarding}
              onboardingStatus={onboardingStatus}
              savingOnboarding={savingOnboarding}
              onSaveOnboarding={saveOnboarding}
              sensitiveNotes={sensitiveNotes}
              sensitiveNotesAvailable={sensitiveNotesAvailable}
              savingSensitiveNotes={savingSensitiveNotes}
              onSaveSensitiveNotes={saveSensitiveNotes}
              reminders={reminders}
              onCreateReminder={createReminder}
              onActOnReminder={actOnReminder}
              onDeleteAccountData={deleteAccountData}
              locale={locale}
            />
          )}
        </fieldset>
      </div>
    </main>
  );
}
