'use client';

import {
  type SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Activity,
  Check,
  CircleAlert,
  ClipboardCheck,
  Flame,
  LoaderCircle,
  Plus,
  Ruler,
  ScanLine,
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
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import type {
  FoodAnalysis,
  HealthFocus,
  MealCreateRequest,
  Measurement,
  MeasurementCreateRequest,
  WorkoutReadiness,
  WorkoutReadinessRequest,
} from '@/lib/contracts';
import { getCopy, localeMetadata, type Locale } from '@/lib/copy';
import { evaluateMealHealthFindings } from '@/lib/health-rule-engine';
import { canonicalMeasurementUnits, measurementUnitOptions } from '@/lib/measurement-conversions';

type Meal = {
  id: string;
  name: string;
  mealType: MealCreateRequest['mealType'];
  occurredAt: string;
  confidence: number;
  nutritionSnapshot: FoodAnalysis['snapshot'];
};

const targets = [
  {
    key: 'calories',
    label: 'Calories',
    target: 1850,
    unit: 'kcal',
    color: 'bg-orange-400',
  },
  {
    key: 'protein',
    label: 'Protein',
    target: 90,
    unit: 'g',
    color: 'bg-violet-500',
  },
  {
    key: 'fiber',
    label: 'Fiber',
    target: 28,
    unit: 'g',
    color: 'bg-emerald-500',
  },
  {
    key: 'sodium',
    label: 'Sodium',
    target: 2000,
    unit: 'mg',
    color: 'bg-rose-500',
  },
] as const;
type TargetKey = (typeof targets)[number]['key'];

function requestId() {
  return crypto.randomUUID();
}

function bangkokDate() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function Dashboard({ displayName }: { displayName: string }) {
  const [locale, setLocale] = useState<Locale>('en');
  const [page, setPage] = useState<
    'today' | 'capture' | 'measurements' | 'workouts' | 'settings'
  >('today');
  const [meals, setMeals] = useState<Meal[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [workoutReadiness, setWorkoutReadiness] =
    useState<WorkoutReadiness | null>(null);
  const [targetValues, setTargetValues] = useState<Record<TargetKey, number>>({
    calories: 1850,
    protein: 90,
    fiber: 28,
    sodium: 2000,
  });
  const [healthFocuses, setHealthFocuses] = useState<HealthFocus[]>([]);
  const [draft, setDraft] = useState('');
  const [captureMode, setCaptureMode] = useState<
    'text' | 'barcode' | 'vietnam_database' | 'usda'
  >('text');
  const [vietnamCatalog, setVietnamCatalog] = useState<'ingredient' | 'dish'>(
    'dish',
  );
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingTargets, setSavingTargets] = useState(false);
  const [savingFocuses, setSavingFocuses] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadMeals = useCallback(async () => {
    try {
      const response = await fetch(`/api/meals?date=${bangkokDate()}`, {
        cache: 'no-store',
      });
      const body = (await response.json()) as {
        error?: string;
        meals?: Meal[];
      };
      if (!response.ok)
        throw new Error(body.error || 'We could not load today’s meals.');
      setMeals(body.meals ?? []);
      const profileResponse = await fetch('/api/profile', {
        cache: 'no-store',
      });
      const profile = (await profileResponse.json()) as {
        locale?: Locale;
        targets?: Array<{ metric: TargetKey; value: number }>;
      };
      if (profileResponse.ok && profile.locale) setLocale(profile.locale);
      const returnedTargets = profile.targets;
      if (profileResponse.ok && returnedTargets)
        setTargetValues((current) => ({
          ...current,
          ...Object.fromEntries(
            returnedTargets.map((target) => [target.metric, target.value]),
          ),
        }));
      const focusesResponse = await fetch('/api/profile/health-focuses', {
        cache: 'no-store',
      });
      const focusBody = (await focusesResponse.json()) as {
        focuses?: HealthFocus[];
      };
      if (focusesResponse.ok && focusBody.focuses)
        setHealthFocuses(focusBody.focuses);
      const measurementsResponse = await fetch('/api/measurements?days=90', {
        cache: 'no-store',
      });
      const measurementBody = (await measurementsResponse.json()) as {
        measurements?: Measurement[];
      };
      if (measurementsResponse.ok && measurementBody.measurements)
        setMeasurements(measurementBody.measurements);
      const readinessResponse = await fetch('/api/workouts/readiness', {
        cache: 'no-store',
      });
      const readinessBody = (await readinessResponse.json()) as WorkoutReadiness;
      if (readinessResponse.ok) setWorkoutReadiness(readinessBody);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'We could not load today’s meals.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMeals();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMeals]);

  useEffect(() => {
    document.documentElement.lang = localeMetadata[locale].documentLang;
  }, [locale]);

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

  async function analyseMeal(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    setAnalysing(true);
    try {
      const request =
        captureMode === 'barcode'
          ? { mode: 'barcode', barcode: draft }
          : captureMode === 'vietnam_database'
            ? {
                mode: 'vietnam_database',
                query: draft,
                catalog: vietnamCatalog,
              }
            : captureMode === 'usda'
              ? { mode: 'usda', query: draft }
              : { mode: 'text', text: draft };
      const response = await fetch('/api/meals/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      const body = (await response.json()) as {
        error?: string;
        analysis?: FoodAnalysis;
      };
      if (!response.ok)
        throw new Error(body.error || 'We could not prepare a review.');
      if (!body.analysis)
        throw new Error('The meal review was incomplete. Please try again.');
      setAnalysis(body.analysis);
    } catch (analysisError) {
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : 'We could not prepare a review.',
      );
    } finally {
      setAnalysing(false);
    }
  }

  function updateAnalysis(
    field: keyof FoodAnalysis['snapshot']['totals'],
    value: string,
  ) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return;
    setAnalysis((current) => {
      if (!current) return current;
      const totals = { ...current.snapshot.totals, [field]: numeric };
      return {
        ...current,
        snapshot: { ...current.snapshot, totals },
        healthFindings: evaluateMealHealthFindings(totals, healthFocuses, current.snapshot.ingredients),
      };
    });
  }

  async function confirmMeal() {
    if (!analysis) return;
    setSaving(true);
    setError('');
    const payload: MealCreateRequest = {
      idempotencyKey: requestId(),
      name: analysis.name,
      mealType: analysis.mealType,
      occurredAt: new Date().toISOString(),
      confidence: analysis.confidence,
      analysisSource: analysis.snapshot.source,
      nutritionSnapshot: {
        ...analysis.snapshot,
        estimationLevel: 'user_confirmed',
      },
    };
    try {
      const response = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as {
        error?: string;
        replayed?: boolean;
      };
      if (!response.ok)
        throw new Error(body.error || 'We could not save this meal.');
      setAnalysis(null);
      setDraft('');
      setNotice(
        body.replayed
          ? 'Your earlier save was already recorded.'
          : 'Meal saved. Today’s totals are now based on your confirmed entry.',
      );
      setPage('today');
      await loadMeals();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'We could not save this meal.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveTargets(nextTargets: Record<TargetKey, number>) {
    setSavingTargets(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: requestId(),
          targets: targets.map((target) => ({
            metric: target.key,
            value: nextTargets[target.key],
            unit: target.unit,
          })),
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        replayed?: boolean;
        targets?: Array<{ metric: TargetKey; value: number }>;
      };
      if (!response.ok || !body.targets)
        throw new Error(body.error || 'We could not save your targets.');
      setTargetValues((current) => ({
        ...current,
        ...Object.fromEntries(
          body.targets!.map((target) => [target.metric, target.value]),
        ),
      }));
      setNotice(
        body.replayed
          ? 'Your earlier target change was already saved.'
          : 'Personal targets saved. Clinician-defined targets remain in effect where present.',
      );
      setPage('today');
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'We could not save your targets.',
      );
    } finally {
      setSavingTargets(false);
    }
  }

  async function saveHealthFocuses(nextFocuses: HealthFocus[]) {
    setSavingFocuses(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/profile/health-focuses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: requestId(),
          focuses: nextFocuses,
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        replayed?: boolean;
        focuses?: HealthFocus[];
      };
      if (!response.ok || !body.focuses)
        throw new Error(body.error || 'We could not save your health focuses.');
      setHealthFocuses(body.focuses);
      setNotice(
        body.replayed
          ? 'Your earlier health-focus change was already saved.'
          : 'Health focuses saved. Future meal reviews will prioritize the selected checks.',
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'We could not save your health focuses.',
      );
    } finally {
      setSavingFocuses(false);
    }
  }

  async function saveMeasurement(nextMeasurement: MeasurementCreateRequest) {
    setError('');
    setNotice('');
    const response = await fetch('/api/measurements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextMeasurement),
    });
    const body = (await response.json()) as {
      error?: string;
      replayed?: boolean;
    };
    if (!response.ok)
      throw new Error(body.error || 'We could not save this measurement.');
    setNotice(
      body.replayed
        ? 'Your earlier measurement was already recorded.'
        : 'Confirmed measurement saved to your private history.',
    );
    await loadMeals();
  }

  async function saveWorkoutReadiness(nextReadiness: WorkoutReadinessRequest) {
    setError('');
    setNotice('');
    const response = await fetch('/api/workouts/readiness', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextReadiness),
    });
    const body = (await response.json()) as WorkoutReadiness & {
      error?: string;
      replayed?: boolean;
    };
    if (!response.ok)
      throw new Error(body.error || 'We could not save workout readiness.');
    setWorkoutReadiness(body);
    setNotice(
      body.status === 'cleared'
        ? 'Workout readiness confirmed. A plan can be considered after you choose your equipment and availability.'
        : 'Workout-plan generation is paused until you review the reported safety concern with an appropriate clinician.',
    );
  }

  async function changeLocale(nextLocale: Locale) {
    const previousLocale = locale;
    if (nextLocale === previousLocale) return;
    setLocale(nextLocale);
    setError('');
    try {
      const response = await fetch('/api/profile/locale', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: requestId(),
          locale: nextLocale,
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        locale?: Locale;
      };
      if (!response.ok || !body.locale)
        throw new Error(
          body.error || 'We could not save your language preference.',
        );
      setLocale(body.locale);
    } catch (localeError) {
      setLocale(previousLocale);
      setError(
        localeError instanceof Error
          ? localeError.message
          : 'We could not save your language preference.',
      );
    }
  }

  const c = getCopy(locale);
  const today = new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Bangkok',
  }).format(new Date());

  return (
    <main className="min-h-screen bg-[#f4f8f5] text-slate-900">
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
            variant={page === 'today' ? 'default' : 'ghost'}
            className={
              page === 'today' ? 'bg-emerald-800 hover:bg-emerald-900' : ''
            }
            onClick={() => setPage('today')}
          >
            {c.nav.today}
          </Button>
          <Button
            variant={page === 'capture' ? 'default' : 'ghost'}
            className={
              page === 'capture' ? 'bg-emerald-800 hover:bg-emerald-900' : ''
            }
            onClick={() => setPage('capture')}
          >
            {c.nav.capture}
          </Button>
          <Button
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
            variant={page === 'workouts' ? 'default' : 'ghost'}
            className={
              page === 'workouts' ? 'bg-emerald-800 hover:bg-emerald-900' : ''
            }
            onClick={() => setPage('workouts')}
          >
            {c.nav.workouts}
          </Button>
          <Button
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
        {notice ? <Notice tone="success" text={notice} /> : null}
        {error ? <Notice tone="error" text={error} /> : null}
        {page === 'today' ? (
          <Today
            meals={meals}
            totals={totals}
            targets={targetValues}
            loading={loading}
            onCapture={() => setPage('capture')}
            locale={locale}
          />
        ) : page === 'capture' ? (
          <Capture
            captureMode={captureMode}
            setCaptureMode={setCaptureMode}
            vietnamCatalog={vietnamCatalog}
            setVietnamCatalog={setVietnamCatalog}
            draft={draft}
            setDraft={setDraft}
            analysis={analysis}
            analysing={analysing}
            saving={saving}
            onAnalyse={analyseMeal}
            onNutrientChange={updateAnalysis}
            onDiscard={() => setAnalysis(null)}
            onConfirm={confirmMeal}
            locale={locale}
          />
        ) : page === 'measurements' ? (
          <Measurements
            entries={measurements}
            onSave={saveMeasurement}
            locale={locale}
          />
        ) : page === 'workouts' ? (
          <WorkoutReadinessScreen
            readiness={workoutReadiness}
            onSave={saveWorkoutReadiness}
            locale={locale}
          />
        ) : (
          <Settings
            key={JSON.stringify({ targetValues, healthFocuses })}
            targets={targetValues}
            saving={savingTargets}
            onSave={saveTargets}
            healthFocuses={healthFocuses}
            savingFocuses={savingFocuses}
            onSaveFocuses={saveHealthFocuses}
            locale={locale}
          />
        )}
      </div>
    </main>
  );
}

function Notice({ tone, text }: { tone: 'success' | 'error'; text: string }) {
  return (
    <div
      className={`mb-5 flex gap-2 rounded-xl border p-3 text-sm ${tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : 'border-rose-200 bg-rose-50 text-rose-950'}`}
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      {text}
    </div>
  );
}

function Today({
  meals,
  totals,
  targets: targetValues,
  loading,
  onCapture,
  locale,
}: {
  meals: Meal[];
  totals: Record<TargetKey, number>;
  targets: Record<TargetKey, number>;
  loading: boolean;
  onCapture: () => void;
  locale: Locale;
}) {
  const c = getCopy(locale);
  const targetLabels: Record<TargetKey, string> = {
    calories: c.today.calories,
    protein: c.today.protein,
    fiber: c.today.fiber,
    sodium: c.today.sodium,
  };
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
        {targets.map((target) => {
          const actual = totals[target.key];
          const targetValue = targetValues[target.key];
          const hasTarget = targetValue > 0;
          const value = hasTarget
            ? Math.min(100, Math.round((actual / targetValue) * 100))
            : 0;
          const remaining = hasTarget ? Math.max(0, targetValue - actual) : 0;
          return (
            <Card key={target.key} className="border-none shadow-sm">
              <CardContent className="pt-5">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-600">
                    {targetLabels[target.key]}
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
                  value={value}
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

const measurementOptions = [
  { metric: 'weight', label: 'Weight', unit: 'kg', step: '0.1' },
  {
    metric: 'blood_pressure',
    label: 'Blood pressure',
    unit: 'mmHg',
    step: '1',
  },
  {
    metric: 'blood_glucose',
    label: 'Blood glucose',
    unit: 'mmol/L',
    step: '0.1',
  },
  {
    metric: 'total_cholesterol',
    label: 'Total cholesterol',
    unit: 'mmol/L',
    step: '0.1',
  },
  { metric: 'uric_acid', label: 'Uric acid', unit: 'µmol/L', step: '1' },
  { metric: 'custom_lab', label: 'Custom lab result', unit: '', step: '0.01' },
] as const;
type MeasurementMetric = (typeof measurementOptions)[number]['metric'];
type ConvertibleMeasurementMetric = Exclude<MeasurementMetric, 'custom_lab'>;

type WorkoutReadinessFlag = Exclude<
  keyof WorkoutReadinessRequest,
  'idempotencyKey'
>;

const workoutReadinessFlags: WorkoutReadinessFlag[] = [
  'chestPain',
  'faintingOrDizziness',
  'severeShortnessOfBreath',
  'irregularHeartbeat',
  'clinicianRestriction',
  'exerciseGlucoseRisk',
];

function WorkoutReadinessScreen({
  readiness,
  onSave,
  locale,
}: {
  readiness: WorkoutReadiness | null;
  onSave: (readiness: WorkoutReadinessRequest) => Promise<void>;
  locale: Locale;
}) {
  const [answers, setAnswers] = useState<
    Record<WorkoutReadinessFlag, boolean>
  >({
    chestPain: false,
    faintingOrDizziness: false,
    severeShortnessOfBreath: false,
    irregularHeartbeat: false,
    clinicianRestriction: false,
    exerciseGlucoseRisk: false,
  });
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
      await onSave({ idempotencyKey: requestId(), ...answers });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'We could not save workout readiness.',
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
                <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">
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
            <p className="mt-3 text-sm leading-6">{c.safety.clinicianPriority}</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Measurements({
  entries,
  onSave,
  locale,
}: {
  entries: Measurement[];
  onSave: (measurement: MeasurementCreateRequest) => Promise<void>;
  locale: Locale;
}) {
  const [metric, setMetric] = useState<MeasurementMetric>('weight');
  const [value, setValue] = useState('');
  const [secondaryValue, setSecondaryValue] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [measurementUnit, setMeasurementUnit] = useState('kg');
  const [occurredAt, setOccurredAt] = useState(() =>
    new Date().toISOString().slice(0, 16),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const option = measurementOptions.find((item) => item.metric === metric)!;
  const isConvertibleMetric = metric !== 'custom_lab';
  const supportedUnits = isConvertibleMetric
    ? measurementUnitOptions[metric as ConvertibleMeasurementMetric]
    : [];
  const c = getCopy(locale);
  const metricLabels: Record<MeasurementMetric, string> = {
    weight: c.measurements.metrics.weight,
    blood_pressure: c.measurements.metrics.bloodPressure,
    blood_glucose: c.measurements.metrics.bloodGlucose,
    total_cholesterol: c.measurements.metrics.totalCholesterol,
    uric_acid: c.measurements.metrics.uricAcid,
    custom_lab: c.measurements.metrics.customLab,
  };
  const recent = entries.slice(0, 12);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const primary = Number(value);
    const secondary = secondaryValue ? Number(secondaryValue) : undefined;
    const measuredAt = new Date(occurredAt);
    if (
      !Number.isFinite(primary) ||
      primary <= 0 ||
      Number.isNaN(measuredAt.getTime()) ||
      (metric === 'custom_lab' &&
        (!customLabel.trim() || !customUnit.trim())) ||
      (metric === 'blood_pressure' &&
        (!Number.isFinite(secondary) ||
          secondary === undefined ||
          secondary <= 0))
    ) {
      setError(
        metric === 'blood_pressure'
          ? 'Enter both positive blood pressure values.'
          : metric === 'custom_lab'
            ? 'Name the lab result and enter its unit.'
            : 'Enter a positive measurement value.',
      );
      return;
    }
    setSaving(true);
    try {
      await onSave({
        idempotencyKey: requestId(),
        metric,
        value: primary,
        ...(secondary === undefined ? {} : { secondaryValue: secondary }),
        ...(metric === 'custom_lab' ? { label: customLabel.trim() } : {}),
        unit: metric === 'custom_lab' ? customUnit.trim() : measurementUnit,
        occurredAt: measuredAt.toISOString(),
        source: 'manual',
      });
      setValue('');
      setSecondaryValue('');
      setCustomLabel('');
      setCustomUnit('');
      setOccurredAt(new Date().toISOString().slice(0, 16));
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'We could not save this measurement.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl">
      <div>
        <p className="text-sm font-medium text-slate-500">
          {c.measurements.eyebrow} · {c.common.confirm}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          {c.measurements.title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          {c.measurements.description}
        </p>
      </div>
      <div className="mt-7 grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>{c.measurements.add}</CardTitle>
            <CardDescription>{c.safety.reviewBeforeSaving}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <label className="block text-sm font-medium">
                {c.measurements.metric}
                <select
                  value={metric}
                  onChange={(event) => {
                    const nextMetric = event.target.value as MeasurementMetric;
                    setMetric(nextMetric);
                    setValue('');
                    setSecondaryValue('');
                    setMeasurementUnit(nextMetric === 'custom_lab' ? '' : canonicalMeasurementUnits[nextMetric as ConvertibleMeasurementMetric]);
                  }}
                  className="mt-2 flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                >
                  {measurementOptions.map((item) => (
                    <option key={item.metric} value={item.metric}>
                      {metricLabels[item.metric]}
                    </option>
                  ))}
                </select>
              </label>
              {metric === 'custom_lab' ? (
                <label className="block text-sm font-medium">
                  {c.measurements.customLabel}
                  <Input
                    className="mt-2 bg-white"
                    maxLength={80}
                    placeholder={c.measurements.customLabelPlaceholder}
                    value={customLabel}
                    onChange={(event) => setCustomLabel(event.target.value)}
                    required
                  />
                </label>
              ) : null}
              {metric === 'blood_pressure' ? (
                <div className="grid grid-cols-2 gap-3">
                  <label htmlFor="systolic" className="text-sm font-medium">
                    Systolic
                    <Input
                      id="systolic"
                      className="mt-2 bg-white"
                      type="number"
                      min="1"
                      step="1"
                      inputMode="decimal"
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                      required
                    />
                  </label>
                  <label htmlFor="diastolic" className="text-sm font-medium">
                    Diastolic
                    <Input
                      id="diastolic"
                      className="mt-2 bg-white"
                      type="number"
                      min="1"
                      step="1"
                      inputMode="decimal"
                      value={secondaryValue}
                      onChange={(event) =>
                        setSecondaryValue(event.target.value)
                      }
                      required
                    />
                  </label>
                </div>
              ) : (
                <label className="block text-sm font-medium">
                  {c.measurements.value}
                  <Input
                    className="mt-2 bg-white"
                    type="number"
                    min="0.01"
                    step={option.step}
                    inputMode="decimal"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    required
                  />
                </label>
              )}
              {metric === 'custom_lab' ? (
                <label className="block text-sm font-medium">
                  {c.measurements.unit}
                  <Input
                    className="mt-2 bg-white"
                    maxLength={16}
                    placeholder={c.measurements.unitPlaceholder}
                    value={customUnit}
                    onChange={(event) => setCustomUnit(event.target.value)}
                    required
                  />
                </label>
              ) : (
                <label className="block text-sm font-medium">
                  {c.measurements.unit}
                  <select value={measurementUnit} onChange={(event) => setMeasurementUnit(event.target.value)} className="mt-2 flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm">
                    {supportedUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                  </select>
                  <span className="mt-2 block text-xs text-slate-500">Stored as {canonicalMeasurementUnits[metric as ConvertibleMeasurementMetric]}{metric === 'blood_pressure' ? ' (systolic / diastolic)' : ''}</span>
                </label>
              )}
              <label className="block text-sm font-medium">
                {c.measurements.measuredAt}
                <Input
                  className="mt-2 bg-white"
                  type="datetime-local"
                  value={occurredAt}
                  onChange={(event) => setOccurredAt(event.target.value)}
                  required
                />
              </label>
              {error ? (
                <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">
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
                    <Check /> {c.measurements.saveMeasurement}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardDescription>{c.common.private}</CardDescription>
            <CardTitle className="mt-1">{c.nav.measurements}</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length ? (
              <div className="space-y-3">
                {recent.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"
                  >
                    <div className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                      <Ruler className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {entry.label ??
                          metricLabels[entry.metric as MeasurementMetric] ??
                          entry.metric}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Intl.DateTimeFormat(
                          locale === 'vi' ? 'vi-VN' : 'en-GB',
                          {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                            timeZone: 'Asia/Bangkok',
                          },
                        ).format(new Date(entry.occurredAt))}{' '}
                        · {c.common.confirm}
                      </p>
                    </div>
                    <p className="text-right text-sm font-semibold">
                      {entry.value.toLocaleString()}
                      {entry.secondaryValue === null
                        ? ''
                        : ` / ${entry.secondaryValue.toLocaleString()}`}
                      <span className="mt-0.5 block text-xs font-normal text-slate-500">
                        {entry.unit}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <div>
                  <Ruler className="mx-auto size-7 text-emerald-300" />
                  <p className="mt-3 font-semibold text-slate-600">
                    {c.measurements.emptyTitle}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    {c.measurements.emptyDescription}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Settings({
  targets: currentTargets,
  saving,
  onSave,
  healthFocuses: currentFocuses,
  savingFocuses,
  onSaveFocuses,
  locale,
}: {
  targets: Record<TargetKey, number>;
  saving: boolean;
  onSave: (values: Record<TargetKey, number>) => void;
  healthFocuses: HealthFocus[];
  savingFocuses: boolean;
  onSaveFocuses: (focuses: HealthFocus[]) => void;
  locale: Locale;
}) {
  const c = getCopy(locale);
  const [drafts, setDrafts] = useState<Record<TargetKey, string>>(
    () =>
      Object.fromEntries(
        targets.map((target) => [
          target.key,
          String(currentTargets[target.key]),
        ]),
      ) as Record<TargetKey, string>,
  );
  const [focuses, setFocuses] = useState<HealthFocus[]>(currentFocuses);
  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = Object.fromEntries(
      targets.map((target) => [target.key, Number(drafts[target.key])]),
    ) as Record<TargetKey, number>;
    if (
      Object.values(next).some((value) => !Number.isFinite(value) || value < 0)
    )
      return;
    onSave(next);
  }
  const focusOptions: Array<{
    key: HealthFocus;
    label: string;
    description: string;
  }> = [
    {
      key: 'blood_pressure',
      label: c.settings.bloodPressure,
      description: c.settings.bloodPressureDescription,
    },
    {
      key: 'cholesterol',
      label: c.settings.cholesterol,
      description: c.settings.cholesterolDescription,
    },
    {
      key: 'blood_glucose',
      label: c.settings.bloodGlucose,
      description: c.settings.bloodGlucoseDescription,
    },
    {
      key: 'uric_acid',
      label: c.settings.uricAcid,
      description: c.settings.uricAcidDescription,
    },
  ];
  function toggleFocus(focus: HealthFocus) {
    setFocuses((current) =>
      current.includes(focus)
        ? current.filter((item) => item !== focus)
        : [...current, focus],
    );
  }
  return (
    <section className="mx-auto max-w-2xl">
      <div>
        <p className="text-sm font-medium text-slate-500">
          {c.settings.eyebrow}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          {c.settings.title}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
          {c.settings.description}
        </p>
      </div>
      <Card className="mt-7 border-none shadow-sm">
        <CardHeader>
          <CardTitle>{c.settings.title}</CardTitle>
          <CardDescription>{c.settings.targetsDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {targets.map((target) => (
              <label
                key={target.key}
                className="flex items-center gap-4 rounded-xl bg-slate-50 p-4"
              >
                <span className={`size-2.5 rounded-full ${target.color}`} />
                <span className="min-w-24 flex-1 font-semibold">
                  {target.key === 'calories'
                    ? c.settings.calories
                    : target.key === 'protein'
                      ? c.settings.protein
                      : target.key === 'fiber'
                        ? c.settings.fiber
                        : c.settings.sodium}
                </span>
                <Input
                  type="number"
                  min="0"
                  step={
                    target.key === 'calories' || target.key === 'sodium'
                      ? '1'
                      : '0.1'
                  }
                  inputMode="decimal"
                  value={drafts[target.key]}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [target.key]: event.target.value,
                    }))
                  }
                  aria-label={`${target.key === 'calories' ? c.settings.calories : target.key === 'protein' ? c.settings.protein : target.key === 'fiber' ? c.settings.fiber : c.settings.sodium} ${c.settings.targetSuffix}`}
                  className="w-28 bg-white"
                  required
                />
                <span className="w-10 text-sm text-slate-500">
                  {target.unit}
                </span>
              </label>
            ))}
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
                  <Check /> {c.settings.saveTargets}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card className="mt-6 border-none shadow-sm">
        <CardHeader>
          <CardTitle>{c.settings.healthFocuses}</CardTitle>
          <CardDescription>{c.settings.healthFocusDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {focusOptions.map((option) => {
              const selected = focuses.includes(option.key);
              return (
                <button
                  type="button"
                  key={option.key}
                  aria-label={`${selected ? c.settings.removeFocus : c.settings.addFocus} ${option.label} ${c.settings.focusSuffix}`}
                  aria-pressed={selected}
                  onClick={() => toggleFocus(option.key)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${selected ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <span className="flex items-center justify-between gap-4">
                    <span>
                      <span className="block font-semibold">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-sm leading-5 text-slate-600">
                        {option.description}
                      </span>
                    </span>
                    <span
                      className={`grid size-6 place-items-center rounded-full border ${selected ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-300 text-transparent'}`}
                    >
                      ✓
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <Button
            type="button"
            onClick={() => onSaveFocuses(focuses)}
            disabled={savingFocuses}
            className="mt-5 w-full bg-emerald-800 hover:bg-emerald-900"
          >
            {savingFocuses ? (
              <>
                <LoaderCircle className="animate-spin" /> {c.common.saving}
              </>
            ) : (
              <>
                <Check /> {c.settings.saveHealthFocuses}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      <p className="mt-4 text-xs leading-5 text-slate-500">
        {c.settings.sensitiveDataNotice}
      </p>
    </section>
  );
}

function Capture({
  captureMode,
  setCaptureMode,
  vietnamCatalog,
  setVietnamCatalog,
  draft,
  setDraft,
  analysis,
  analysing,
  saving,
  onAnalyse,
  onNutrientChange,
  onDiscard,
  onConfirm,
  locale,
}: {
  captureMode: 'text' | 'barcode' | 'vietnam_database' | 'usda';
  setCaptureMode: (
    mode: 'text' | 'barcode' | 'vietnam_database' | 'usda',
  ) => void;
  vietnamCatalog: 'ingredient' | 'dish';
  setVietnamCatalog: (catalog: 'ingredient' | 'dish') => void;
  draft: string;
  setDraft: (value: string) => void;
  analysis: FoodAnalysis | null;
  analysing: boolean;
  saving: boolean;
  onAnalyse: (event: SyntheticEvent<HTMLFormElement>) => void;
  onNutrientChange: (
    field: keyof FoodAnalysis['snapshot']['totals'],
    value: string,
  ) => void;
  onDiscard: () => void;
  onConfirm: () => void;
  locale: Locale;
}) {
  const c = getCopy(locale);
  const isValid =
    captureMode === 'barcode'
      ? /^\d{8,14}$/.test(draft.trim())
      : captureMode === 'vietnam_database' || captureMode === 'usda'
        ? draft.trim().length >= 2
        : draft.trim().length >= 3;
  const providerNote =
    captureMode === 'text'
      ? c.mealCapture.typedProviderNote
      : captureMode === 'barcode'
        ? c.mealCapture.barcodeProviderNote
        : captureMode === 'vietnam_database'
          ? c.mealCapture.vietnamProviderNote
          : c.mealCapture.usdaProviderNote;
  return (
    <section>
      <div>
        <p className="text-sm font-medium text-slate-500">
          {c.mealCapture.eyebrow}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          {c.mealCapture.title}
        </h1>
      </div>
      <div className="mt-7 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>{c.mealCapture.title}</CardTitle>
            <CardDescription>{c.mealCapture.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:grid-cols-4">
              <Button
                type="button"
                size="sm"
                variant={captureMode === 'text' ? 'secondary' : 'ghost'}
                onClick={() => {
                  setCaptureMode('text');
                  setDraft('');
                }}
              >
                {c.mealCapture.text}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={captureMode === 'barcode' ? 'secondary' : 'ghost'}
                onClick={() => {
                  setCaptureMode('barcode');
                  setDraft('');
                }}
              >
                <ScanLine /> {c.mealCapture.barcode}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={
                  captureMode === 'vietnam_database' ? 'secondary' : 'ghost'
                }
                onClick={() => {
                  setCaptureMode('vietnam_database');
                  setDraft('');
                }}
              >
                {c.mealCapture.vietnamData}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={captureMode === 'usda' ? 'secondary' : 'ghost'}
                onClick={() => {
                  setCaptureMode('usda');
                  setDraft('');
                }}
              >
                USDA
              </Button>
            </div>
            <form onSubmit={onAnalyse} className="mt-5">
              {captureMode === 'text' ? (
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={c.mealCapture.mealPlaceholder}
                  className="min-h-40"
                />
              ) : captureMode === 'barcode' ? (
                <Input
                  inputMode="numeric"
                  value={draft}
                  onChange={(event) =>
                    setDraft(event.target.value.replace(/\D/g, ''))
                  }
                  placeholder={c.mealCapture.barcodePlaceholder}
                  aria-label={c.mealCapture.barcode}
                />
              ) : captureMode === 'vietnam_database' ? (
                <>
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        vietnamCatalog === 'dish' ? 'secondary' : 'outline'
                      }
                      onClick={() => setVietnamCatalog('dish')}
                    >
                      {c.mealCapture.vietnamDish}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        vietnamCatalog === 'ingredient'
                          ? 'secondary'
                          : 'outline'
                      }
                      onClick={() => setVietnamCatalog('ingredient')}
                    >
                      {c.mealCapture.vietnamIngredient}
                    </Button>
                  </div>
                  <Input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={
                      vietnamCatalog === 'dish'
                        ? c.mealCapture.vietnamDishPlaceholder
                        : c.mealCapture.vietnamIngredientPlaceholder
                    }
                    aria-label={c.mealCapture.vietnamSearchLabel}
                  />
                </>
              ) : (
                <Input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={c.mealCapture.usdaPlaceholder}
                  aria-label={c.mealCapture.usdaSearchLabel}
                />
              )}
              <p className="mt-3 text-xs leading-5 text-slate-500">
                {providerNote}
              </p>
              <Button
                type="submit"
                disabled={analysing || !isValid}
                className="mt-5 w-full bg-emerald-800 hover:bg-emerald-900"
              >
                {analysing ? (
                  <>
                    <LoaderCircle className="animate-spin" />{' '}
                    {c.mealCapture.analysing}
                  </>
                ) : (
                  <>
                    <ClipboardCheck /> {c.mealCapture.analyse}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader>
            <div>
              <CardDescription>{c.mealCapture.reviewTitle}</CardDescription>
              <CardTitle className="mt-1">
                {analysis ? analysis.name : c.mealCapture.reviewPlaceholder}
              </CardTitle>
            </div>
            {analysis ? (
              <span
                className={`rounded-full px-2 py-1 text-xs font-semibold ${analysis.confidence < 70 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}
              >
                {analysis.confidence}% {c.mealCapture.confidence}
              </span>
            ) : null}
          </CardHeader>
          <CardContent>
            {analysis ? (
              <Review
                analysis={analysis}
                onNutrientChange={onNutrientChange}
                onDiscard={onDiscard}
                onConfirm={onConfirm}
                saving={saving}
                locale={locale}
              />
            ) : (
              <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <div>
                  <Utensils className="mx-auto size-8 text-slate-300" />
                  <p className="mt-3 font-semibold text-slate-600">
                    {c.mealCapture.emptyReviewTitle}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    {c.mealCapture.emptyReviewDescription}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Review({
  analysis,
  onNutrientChange,
  onDiscard,
  onConfirm,
  saving,
  locale,
}: {
  analysis: FoodAnalysis;
  onNutrientChange: (
    field: keyof FoodAnalysis['snapshot']['totals'],
    value: string,
  ) => void;
  onDiscard: () => void;
  onConfirm: () => void;
  saving: boolean;
  locale: Locale;
}) {
  const c = getCopy(locale);
  const targetLabels: Record<TargetKey, string> = {
    calories: c.today.calories,
    protein: c.today.protein,
    fiber: c.today.fiber,
    sodium: c.today.sodium,
  };
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {targets.map((target) => (
          <label className="rounded-xl bg-slate-50 p-3" key={target.key}>
            <span className="text-[11px] font-semibold text-slate-500">
              {targetLabels[target.key]}
            </span>
            <Input
              type="number"
              min="0"
              value={analysis.snapshot.totals[target.key]}
              onChange={(event) =>
                onNutrientChange(target.key, event.target.value)
              }
              className="mt-2 h-8 border-0 bg-white px-2 font-semibold shadow-none"
            />
            <span className="mt-1 block text-[11px] text-slate-500">
              {target.unit}
            </span>
          </label>
        ))}
      </div>
      <div className="mt-5">
        <p className="text-sm font-semibold">
          {c.mealCapture.detectedIngredients}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {analysis.snapshot.ingredients.map((ingredient) => (
            <span
              className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700"
              key={ingredient}
            >
              {ingredient}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {c.mealCapture.serving}: {analysis.snapshot.servingDescription}
        </p>
      </div>
      <div
        className={`mt-5 rounded-xl p-4 text-sm leading-6 ${analysis.finding.severity === 'attention' ? 'bg-amber-50 text-amber-950' : 'bg-emerald-50 text-emerald-950'}`}
      >
        <p className="font-semibold">{c.mealCapture.sourceAndReview}</p>
        <p className="mt-1">{analysis.finding.text}</p>
      </div>
      {analysis.healthFindings?.length ? (
        <div className="mt-5 space-y-3">
          <div>
            <p className="text-sm font-semibold">
              {c.mealCapture.conditionChecks}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {c.mealCapture.conditionChecksDescription}
            </p>
          </div>
          {analysis.healthFindings.map((finding) => (
            <div
              className={`rounded-xl border p-4 text-sm leading-6 ${finding.severity === 'attention' ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-emerald-200 bg-emerald-50 text-emerald-950'}`}
              key={finding.ruleCode}
            >
              <p className="font-semibold">
                {finding.condition.replace('_', ' ')} ·{' '}
                {finding.observedValue.toLocaleString(locale)}{' '}
                {finding.observedUnit}
              </p>
              <p className="mt-1">{finding.text}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {finding.suggestedActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs opacity-75">
                Rule {finding.ruleCode} · {finding.ruleVersion}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      {analysis.unresolvedQuestions.map((question) => (
        <p className="mt-3 text-sm text-slate-600" key={question}>
          {question}
        </p>
      ))}
      <div className="mt-6 flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onDiscard}
          disabled={saving}
        >
          {c.mealCapture.discard}
        </Button>
        <Button
          className="flex-1 bg-emerald-800 hover:bg-emerald-900"
          onClick={onConfirm}
          disabled={saving}
        >
          {saving ? (
            <>
              <LoaderCircle className="animate-spin" /> {c.common.saving}
            </>
          ) : (
            <>
              <Check /> {c.mealCapture.confirmAndSave}
            </>
          )}
        </Button>
      </div>
    </>
  );
}
