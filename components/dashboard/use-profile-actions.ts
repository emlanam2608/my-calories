import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type {
  HealthFocus,
  OnboardingDraft,
  SensitiveNotes,
} from '@/lib/contracts';
import { getCopy, type Locale } from '@/lib/copy';
import { createDashboardRequestId } from '@/lib/dashboard-client';
import {
  dashboardTargets,
  type DashboardTargetKey,
} from '@/lib/dashboard-model';

type Options = {
  locale: Locale;
  setLocale: Dispatch<SetStateAction<Locale>>;
  setTargets: Dispatch<SetStateAction<Record<DashboardTargetKey, number>>>;
  setHealthFocuses: Dispatch<SetStateAction<HealthFocus[]>>;
  setOnboarding: Dispatch<SetStateAction<OnboardingDraft>>;
  setOnboardingStatus: Dispatch<SetStateAction<'in_progress' | 'complete'>>;
  setSensitiveNotes: Dispatch<SetStateAction<SensitiveNotes>>;
  setSavingTargets: (value: boolean) => void;
  setSavingFocuses: (value: boolean) => void;
  setSavingOnboarding: (value: boolean) => void;
  setSavingSensitiveNotes: (value: boolean) => void;
  setError: (message: string) => void;
  setNotice: (message: string) => void;
  onTargetsSaved: () => void;
  resetAccountState: () => void;
};

/** Owns profile/settings writes and leaves the dashboard responsible only for composition. */
export function useProfileActions(options: Options) {
  const {
    locale,
    setLocale,
    setTargets,
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
    onTargetsSaved,
    resetAccountState,
  } = options;
  const c = getCopy(locale);

  const saveTargets = useCallback(
    async (nextTargets: Record<DashboardTargetKey, number>) => {
      setSavingTargets(true);
      setError('');
      setNotice('');
      try {
        const response = await fetch('/api/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idempotencyKey: createDashboardRequestId(),
            targets: dashboardTargets.map((target) => ({
              metric: target.key,
              value: nextTargets[target.key],
              unit: target.unit,
            })),
          }),
        });
        const body = (await response.json()) as {
          error?: string;
          replayed?: boolean;
          targets?: Array<{ metric: DashboardTargetKey; value: number }>;
        };
        if (!response.ok || !body.targets)
          throw new Error(body.error || c.feedback.targetsSaveError);
        setTargets((current) => ({
          ...current,
          ...Object.fromEntries(
            body.targets!.map((target) => [target.metric, target.value]),
          ),
        }));
        setNotice(
          body.replayed ? c.feedback.targetsReplayed : c.feedback.targetsSaved,
        );
        onTargetsSaved();
      } catch (error) {
        setError(
          error instanceof Error ? error.message : c.feedback.targetsSaveError,
        );
      } finally {
        setSavingTargets(false);
      }
    },
    [
      c.feedback,
      onTargetsSaved,
      setError,
      setNotice,
      setSavingTargets,
      setTargets,
    ],
  );

  const saveHealthFocuses = useCallback(
    async (focuses: HealthFocus[]) => {
      setSavingFocuses(true);
      setError('');
      setNotice('');
      try {
        const response = await fetch('/api/profile/health-focuses', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idempotencyKey: createDashboardRequestId(),
            focuses,
          }),
        });
        const body = (await response.json()) as {
          error?: string;
          replayed?: boolean;
          focuses?: HealthFocus[];
        };
        if (!response.ok || !body.focuses)
          throw new Error(body.error || c.feedback.focusesSaveError);
        setHealthFocuses(body.focuses);
        setNotice(
          body.replayed ? c.feedback.focusesReplayed : c.feedback.focusesSaved,
        );
      } catch (error) {
        setError(
          error instanceof Error ? error.message : c.feedback.focusesSaveError,
        );
      } finally {
        setSavingFocuses(false);
      }
    },
    [c.feedback, setError, setHealthFocuses, setNotice, setSavingFocuses],
  );

  const saveOnboarding = useCallback(
    async (draft: OnboardingDraft) => {
      setSavingOnboarding(true);
      setError('');
      setNotice('');
      try {
        const response = await fetch('/api/profile/onboarding', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idempotencyKey: createDashboardRequestId(),
            draft,
          }),
        });
        const body = (await response.json()) as {
          error?: string;
          replayed?: boolean;
          draft?: OnboardingDraft;
          status?: 'in_progress' | 'complete';
        };
        if (!response.ok || !body.draft || !body.status)
          throw new Error(body.error || c.feedback.onboardingSaveError);
        setOnboarding(body.draft);
        setOnboardingStatus(body.status);
        setNotice(
          body.replayed
            ? c.feedback.onboardingReplayed
            : body.status === 'complete'
              ? c.feedback.onboardingComplete
              : c.feedback.onboardingSaved,
        );
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : c.feedback.onboardingSaveError,
        );
      } finally {
        setSavingOnboarding(false);
      }
    },
    [
      c.feedback,
      setError,
      setNotice,
      setOnboarding,
      setOnboardingStatus,
      setSavingOnboarding,
    ],
  );

  const saveSensitiveNotes = useCallback(
    async (notes: SensitiveNotes) => {
      setSavingSensitiveNotes(true);
      setError('');
      setNotice('');
      try {
        const response = await fetch('/api/profile/sensitive-notes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idempotencyKey: createDashboardRequestId(),
            notes,
          }),
        });
        const body = (await response.json()) as {
          error?: string;
          notes?: SensitiveNotes;
        };
        if (!response.ok || !body.notes)
          throw new Error(body.error || c.feedback.notesSaveError);
        setSensitiveNotes(body.notes);
        setNotice(c.feedback.notesSaved);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : c.feedback.notesSaveError,
        );
      } finally {
        setSavingSensitiveNotes(false);
      }
    },
    [
      c.feedback,
      setError,
      setNotice,
      setSavingSensitiveNotes,
      setSensitiveNotes,
    ],
  );

  const changeLocale = useCallback(
    async (nextLocale: Locale) => {
      if (nextLocale === locale) return;
      setLocale(nextLocale);
      setError('');
      try {
        const response = await fetch('/api/profile/locale', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idempotencyKey: createDashboardRequestId(),
            locale: nextLocale,
          }),
        });
        const body = (await response.json()) as {
          error?: string;
          locale?: Locale;
        };
        if (!response.ok || !body.locale)
          throw new Error(body.error || c.feedback.localeSaveError);
        setLocale(body.locale);
      } catch (error) {
        setLocale(locale);
        setError(
          error instanceof Error ? error.message : c.feedback.localeSaveError,
        );
      }
    },
    [c.feedback.localeSaveError, locale, setError, setLocale],
  );

  const deleteAccountData = useCallback(async () => {
    setError('');
    setNotice('');
    const response = await fetch('/api/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotencyKey: createDashboardRequestId(),
        confirmation: 'DELETE MY DATA',
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!response.ok)
      throw new Error(body.error || c.feedback.accountDeleteError);
    resetAccountState();
    setNotice(c.feedback.accountDeleted);
  }, [c.feedback, resetAccountState, setError, setNotice]);

  return {
    saveTargets,
    saveHealthFocuses,
    saveOnboarding,
    saveSensitiveNotes,
    changeLocale,
    deleteAccountData,
  };
}
