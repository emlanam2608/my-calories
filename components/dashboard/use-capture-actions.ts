import {
  useCallback,
  type Dispatch,
  type SetStateAction,
  type SyntheticEvent,
} from 'react';
import type {
  FoodAnalysis,
  HealthFocus,
  MealCreateRequest,
  SavedFood,
} from '@/lib/contracts';
import { getCopy, type Locale } from '@/lib/copy';
import { createDashboardRequestId } from '@/lib/dashboard-client';
import { evaluateMealHealthFindings } from '@/lib/health-rule-engine';

export type CaptureMode =
  | 'text'
  | 'barcode'
  | 'vietnam_database'
  | 'usda'
  | 'photo';
export type VietnamCatalog = 'ingredient' | 'dish';

type Options = {
  locale: Locale;
  captureMode: CaptureMode;
  vietnamCatalog: VietnamCatalog;
  draft: string;
  analysis: FoodAnalysis | null;
  healthFocuses: HealthFocus[];
  reload: () => Promise<void>;
  setPage: (page: 'today' | 'capture') => void;
  setDraft: Dispatch<SetStateAction<string>>;
  setCaptureMode: Dispatch<SetStateAction<CaptureMode>>;
  setAnalysis: Dispatch<SetStateAction<FoodAnalysis | null>>;
  setSavedFoods: Dispatch<SetStateAction<SavedFood[]>>;
  setDeletingSavedFoodId: Dispatch<SetStateAction<string | null>>;
  setAnalysing: (value: boolean) => void;
  setSaving: (value: boolean) => void;
  setSavingPersonalFood: (value: boolean) => void;
  setError: (message: string) => void;
  setNotice: (message: string) => void;
};

/** Owns review-first meal capture and personal-food mutations. */
export function useCaptureActions(options: Options) {
  const {
    locale,
    captureMode,
    vietnamCatalog,
    draft,
    analysis,
    healthFocuses,
    reload,
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
  } = options;
  const c = getCopy(locale);

  const analyseMeal = useCallback(
    async (event: SyntheticEvent<HTMLFormElement>) => {
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
          throw new Error(body.error || c.feedback.mealReviewError);
        if (!body.analysis) throw new Error(c.feedback.mealReviewIncomplete);
        setAnalysis(body.analysis);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : c.feedback.mealReviewError,
        );
      } finally {
        setAnalysing(false);
      }
    },
    [
      c.feedback,
      captureMode,
      draft,
      setAnalysing,
      setAnalysis,
      setError,
      setNotice,
      vietnamCatalog,
    ],
  );

  const updateAnalysis = useCallback(
    (field: keyof FoodAnalysis['snapshot']['totals'], value: string) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric < 0) return;
      setAnalysis((current) => {
        if (!current) return current;
        const totals = { ...current.snapshot.totals, [field]: numeric };
        return {
          ...current,
          snapshot: { ...current.snapshot, totals },
          healthFindings: evaluateMealHealthFindings(
            totals,
            healthFocuses,
            current.snapshot.ingredients,
            current.snapshot.additionalNutrients,
          ),
        };
      });
    },
    [healthFocuses, setAnalysis],
  );

  const updateAnalysisDetails = useCallback(
    (servingDescription: string, ingredientsText: string) => {
      const ingredients = ingredientsText
        .split(',')
        .map((ingredient) => ingredient.trim())
        .filter(Boolean)
        .slice(0, 24);
      setAnalysis((current) => {
        if (!current) return current;
        const snapshot = {
          ...current.snapshot,
          servingDescription,
          ingredients,
        };
        return {
          ...current,
          snapshot,
          healthFindings: evaluateMealHealthFindings(
            snapshot.totals,
            healthFocuses,
            ingredients,
            current.snapshot.additionalNutrients,
          ),
        };
      });
    },
    [healthFocuses, setAnalysis],
  );

  const confirmMeal = useCallback(async () => {
    if (!analysis) return false;
    setSaving(true);
    setError('');
    const payload: MealCreateRequest = {
      idempotencyKey: createDashboardRequestId(),
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
      if (!response.ok) throw new Error(body.error || c.feedback.mealSaveError);
      setAnalysis(null);
      setDraft('');
      setNotice(body.replayed ? c.feedback.mealReplayed : c.feedback.mealSaved);
      setPage('today');
      await reload();
      return true;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : c.feedback.mealSaveError,
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    analysis,
    c.feedback,
    reload,
    setAnalysis,
    setDraft,
    setError,
    setNotice,
    setPage,
    setSaving,
  ]);

  const savePersonalFood = useCallback(
    async (kind: 'food' | 'recipe') => {
      if (!analysis) return;
      setSavingPersonalFood(true);
      setError('');
      try {
        const response = await fetch('/api/saved-foods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idempotencyKey: createDashboardRequestId(),
            kind,
            name: analysis.name,
            nameVi: analysis.nameVi,
            nutritionSnapshot: {
              ...analysis.snapshot,
              estimationLevel: 'user_confirmed',
            },
          }),
        });
        const body = (await response.json()) as {
          id?: string;
          error?: string;
          replayed?: boolean;
        };
        if (!response.ok)
          throw new Error(body.error || c.feedback.savedFoodSaveError);
        setNotice(
          body.replayed
            ? c.feedback.savedFoodReplayed
            : kind === 'recipe'
              ? c.feedback.recipeSaved
              : c.feedback.foodSaved,
        );
        if (body.id)
          setSavedFoods((current) => [
            {
              id: body.id!,
              kind,
              name: analysis.name,
              nameVi: analysis.nameVi,
              nutritionSnapshot: {
                ...analysis.snapshot,
                estimationLevel: 'user_confirmed',
              },
              updatedAt: new Date().toISOString(),
            },
            ...current.filter((item) => item.id !== body.id),
          ]);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : c.feedback.savedFoodSaveError,
        );
      } finally {
        setSavingPersonalFood(false);
      }
    },
    [
      analysis,
      c.feedback,
      setError,
      setNotice,
      setSavedFoods,
      setSavingPersonalFood,
    ],
  );

  const reviewSavedFood = useCallback(
    (savedFood: SavedFood) => {
      const snapshot = {
        ...savedFood.nutritionSnapshot,
        source: 'manual_entry' as const,
        sourceVersion: 'personal-food-v1',
        sourceReference: `personal-food:${savedFood.id}`,
        estimationLevel: 'user_confirmed' as const,
      };
      setAnalysis({
        name: savedFood.name,
        nameVi: savedFood.nameVi,
        mealType: 'lunch',
        confidence: 100,
        unresolvedQuestions: [],
        snapshot,
        finding: {
          code: 'personal-food-library',
          severity: 'info',
          text: c.feedback.personalFoodReview,
        },
        healthFindings: evaluateMealHealthFindings(
          snapshot.totals,
          healthFocuses,
          snapshot.ingredients,
          snapshot.additionalNutrients,
        ),
      });
      setCaptureMode('text');
    },
    [c.feedback.personalFoodReview, healthFocuses, setAnalysis, setCaptureMode],
  );

  const deleteSavedFood = useCallback(
    async (savedFood: SavedFood) => {
      setDeletingSavedFoodId(savedFood.id);
      setError('');
      try {
        const response = await fetch(`/api/saved-foods/${savedFood.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idempotencyKey: createDashboardRequestId() }),
        });
        const body = (await response.json()) as { error?: string };
        if (!response.ok)
          throw new Error(body.error || c.feedback.savedFoodDeleteError);
        setSavedFoods((current) =>
          current.filter((item) => item.id !== savedFood.id),
        );
        setNotice(c.feedback.savedFoodDeleted);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : c.feedback.savedFoodDeleteError,
        );
      } finally {
        setDeletingSavedFoodId(null);
      }
    },
    [c.feedback, setDeletingSavedFoodId, setError, setNotice, setSavedFoods],
  );

  return {
    analyseMeal,
    updateAnalysis,
    updateAnalysisDetails,
    confirmMeal,
    savePersonalFood,
    reviewSavedFood,
    deleteSavedFood,
  };
}
