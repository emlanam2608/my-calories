import type {
  Analytics,
  EffectiveSafetyContext,
  HealthFocus,
  Measurement,
  OnboardingDraft,
  Reminder,
  SavedFood,
  SensitiveNotes,
  WorkoutReadiness,
} from './contracts';
import type { Locale } from './copy';
import type { ExerciseCatalogEntry } from './exercise-catalog';
import type { ActiveWorkoutPlan } from './workout-plan-lifecycle';
import type {
  WorkoutEvidenceCheckin,
  WorkoutEvidenceLog,
} from './workout-evidence';
import type { WorkoutAdaptationProposal } from './workout-adaptation-contracts';
import type { DashboardMeal, DashboardTargetKey } from './dashboard-model';
import type { EffectiveTarget } from './targets';

export type DashboardBootstrap = {
  meals: DashboardMeal[];
  locale?: Locale;
  targets?: EffectiveTarget[];
  focuses?: HealthFocus[];
  onboarding?: { draft: OnboardingDraft; status: 'in_progress' | 'complete' };
  sensitiveNotes?: SensitiveNotes;
  sensitiveNotesAvailable: boolean;
  measurements?: Measurement[];
  readiness?: WorkoutReadiness;
  safetyContext?: EffectiveSafetyContext;
  exercises?: ExerciseCatalogEntry[];
  plan?: ActiveWorkoutPlan | null;
  logs?: WorkoutEvidenceLog[];
  checkin?: WorkoutEvidenceCheckin | null;
  proposal?: WorkoutAdaptationProposal | null;
  analytics?: Analytics;
  savedFoods?: SavedFood[];
  reminders?: Reminder[];
};

async function read<T>(
  path: string,
): Promise<{ ok: boolean; status: number; body: T }> {
  const response = await fetch(path, { cache: 'no-store' });
  return {
    ok: response.ok,
    status: response.status,
    body: (await response.json()) as T,
  };
}

export class DashboardBootstrapError extends Error {
  constructor(
    message: string,
    readonly kind: 'permission' | 'request',
  ) {
    super(message);
    this.name = 'DashboardBootstrapError';
  }
}

/** Fetches only read-only, owner-scoped dashboard resources. */
export async function loadDashboardBootstrap(
  date: string,
  fallbackError: string,
  permissionError: string,
): Promise<DashboardBootstrap> {
  const meals = await read<{ error?: string; meals?: DashboardMeal[] }>(
    `/api/meals?date=${encodeURIComponent(date)}`,
  );
  if (!meals.ok)
    throw new DashboardBootstrapError(
      meals.status === 401 || meals.status === 403
        ? permissionError
        : meals.body.error || fallbackError,
      meals.status === 401 || meals.status === 403 ? 'permission' : 'request',
    );
  const [
    profile,
    focuses,
    onboarding,
    sensitiveNotes,
    measurements,
    readiness,
    safetyContext,
    exercises,
    plan,
    logs,
    checkin,
    proposal,
    analytics,
    savedFoods,
    reminders,
  ] = await Promise.all([
    read<{
      locale?: Locale;
      targets?: Array<EffectiveTarget & { metric: DashboardTargetKey }>;
    }>('/api/profile'),
    read<{ focuses?: HealthFocus[] }>('/api/profile/health-focuses'),
    read<{ draft?: OnboardingDraft; status?: 'in_progress' | 'complete' }>(
      '/api/profile/onboarding',
    ),
    read<{ notes?: SensitiveNotes }>('/api/profile/sensitive-notes'),
    read<{ measurements?: Measurement[] }>('/api/measurements?days=90'),
    read<WorkoutReadiness>('/api/workouts/readiness'),
    read<{ context?: EffectiveSafetyContext }>('/api/safety-context'),
    read<{ exercises?: ExerciseCatalogEntry[] }>('/api/exercises'),
    read<{ plan?: ActiveWorkoutPlan | null }>('/api/workout-plans'),
    read<{ logs?: WorkoutEvidenceLog[] }>('/api/workout-logs'),
    read<{ checkin?: WorkoutEvidenceCheckin | null }>('/api/workout-checkins'),
    read<{ proposal?: WorkoutAdaptationProposal | null }>(
      '/api/workout-plan-proposals',
    ),
    read<Analytics>('/api/analytics?days=30'),
    read<{ savedFoods?: SavedFood[] }>('/api/saved-foods'),
    read<{ reminders?: Reminder[] }>('/api/reminders'),
  ]);
  const resources = [
    profile,
    focuses,
    onboarding,
    sensitiveNotes,
    measurements,
    readiness,
    safetyContext,
    exercises,
    plan,
    logs,
    checkin,
    proposal,
    analytics,
    savedFoods,
    reminders,
  ];
  if (
    resources.some(
      (resource) => resource.status === 401 || resource.status === 403,
    )
  ) {
    throw new DashboardBootstrapError(permissionError, 'permission');
  }
  const requiredResources = [
    profile,
    focuses,
    onboarding,
    measurements,
    readiness,
    safetyContext,
    exercises,
    plan,
    logs,
    checkin,
    proposal,
    analytics,
    savedFoods,
    reminders,
  ];
  if (requiredResources.some((resource) => !resource.ok)) {
    throw new DashboardBootstrapError(fallbackError, 'request');
  }
  return {
    meals: meals.body.meals ?? [],
    locale: profile.ok ? profile.body.locale : undefined,
    targets: profile.ok ? profile.body.targets : undefined,
    focuses: focuses.ok ? focuses.body.focuses : undefined,
    onboarding:
      onboarding.ok && onboarding.body.draft
        ? {
            draft: onboarding.body.draft,
            status: onboarding.body.status ?? 'in_progress',
          }
        : undefined,
    sensitiveNotes: sensitiveNotes.ok ? sensitiveNotes.body.notes : undefined,
    sensitiveNotesAvailable: sensitiveNotes.ok,
    measurements: measurements.ok ? measurements.body.measurements : undefined,
    readiness: readiness.ok ? readiness.body : undefined,
    safetyContext: safetyContext.ok ? safetyContext.body.context : undefined,
    exercises: exercises.ok ? exercises.body.exercises : undefined,
    plan: plan.ok ? (plan.body.plan ?? null) : undefined,
    logs: logs.ok ? logs.body.logs : undefined,
    checkin: checkin.ok ? (checkin.body.checkin ?? null) : undefined,
    proposal: proposal.ok ? (proposal.body.proposal ?? null) : undefined,
    analytics: analytics.ok ? analytics.body : undefined,
    savedFoods: savedFoods.ok ? savedFoods.body.savedFoods : undefined,
    reminders: reminders.ok ? reminders.body.reminders : undefined,
  };
}
