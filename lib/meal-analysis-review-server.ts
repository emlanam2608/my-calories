import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { healthFocuses, healthTargets, mealAnalysisReviews } from '@/db/schema';
import {
  healthFocusSchema,
  reviewedMealAnalysisSchema,
  type HealthFocus,
  type MealReviewDraft,
} from './contracts';
import { evaluateMealHealthFindings } from './health-rule-engine';
import { selectTargets, type EffectiveTarget } from './targets';

export const mealAnalysisReviewVersion = 'meal-analysis-review-1' as const;
export const mealAnalysisReviewTtlMs = 30 * 60 * 1_000;

export function mealReviewContextFingerprint(
  focuses: HealthFocus[],
  targets: EffectiveTarget[],
) {
  return JSON.stringify({
    version: mealAnalysisReviewVersion,
    focuses: [...focuses].sort(),
    targets: [...targets]
      .sort((left, right) => left.metric.localeCompare(right.metric))
      .map(({ metric, value, unit, authority }) => ({ metric, value, unit, authority })),
  });
}

export async function resolveMealReviewContext(ownerId: string) {
  const db = getDb();
  const [focusRows, targetRows] = await Promise.all([
    db.select({ focus: healthFocuses.focus })
      .from(healthFocuses)
      .where(eq(healthFocuses.ownerId, ownerId)),
    db.select({
      metric: healthTargets.metric,
      valueScaled: healthTargets.valueScaled,
      valueScale: healthTargets.valueScale,
      unit: healthTargets.unit,
      authority: healthTargets.authority,
      updatedAt: healthTargets.updatedAt,
    }).from(healthTargets).where(eq(healthTargets.ownerId, ownerId)),
  ]);
  const focuses = focusRows.flatMap((row) => {
    const parsed = healthFocusSchema.safeParse(row.focus);
    return parsed.success ? [parsed.data] : [];
  });
  const targets = selectTargets(targetRows);
  return {
    focuses,
    targets,
    fingerprint: mealReviewContextFingerprint(focuses, targets),
  };
}

export async function issueMealAnalysisReview(
  ownerId: string,
  draft: MealReviewDraft,
  now = new Date(),
) {
  const context = await resolveMealReviewContext(ownerId);
  const analysis = reviewedMealAnalysisSchema.parse({
    ...draft,
    healthFindings: evaluateMealHealthFindings(
      draft.snapshot.totals,
      context.focuses,
      draft.snapshot.ingredients,
      draft.snapshot.additionalNutrients,
      context.targets,
      draft.snapshot.estimationLevel,
    ),
  });
  const id = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + mealAnalysisReviewTtlMs);
  await getDb().insert(mealAnalysisReviews).values({
    id,
    ownerId,
    analysis,
    contextFingerprint: context.fingerprint,
    expiresAt,
    consumedAt: null,
    createdAt: now,
  });
  return reviewedMealAnalysisSchema.parse({
    ...analysis,
    serverReview: { id, expiresAt: expiresAt.toISOString() },
  });
}
