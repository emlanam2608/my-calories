import { getChatGPTUser } from '@/app/chatgpt-auth';
import { analyseFoodRequestSchema, mealReviewDraftSchema, type FoodAnalysis } from '@/lib/contracts';
import { analyseTypedFood } from '@/lib/food-analysis';
import { lookupOpenFoodFacts } from '@/lib/open-food-facts';
import { lookupVietnamNutrition } from '@/lib/vietnam-nutrition';
import { lookupUsdaFoodData } from '@/lib/usda-fooddata';
import { resolveCachedFoodAnalysis } from '@/lib/food-lookup-cache';
import { manualProviderFallback } from '@/lib/provider-fallback';
import { consumeRequestQuota } from '@/lib/request-quota';
import { resolvePersonalFood } from '@/lib/saved-foods';
import { issueMealAnalysisReview } from '@/lib/meal-analysis-review-server';

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });

  const quota = consumeRequestQuota('meal_analysis', user.userId, { limit: 30, windowMs: 60 * 60 * 1_000 });
  if (!quota.allowed) return Response.json(
    { error: 'Meal analysis is temporarily limited to protect provider availability. Please try again shortly.' },
    { status: 429, headers: { 'Retry-After': String(quota.retryAfterSeconds), 'Cache-Control': 'no-store' } },
  );

  const body = await request.json().catch(() => null);
  const parsed = analyseFoodRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Enter a meal description or an 8–14 digit barcode.' }, { status: 400 });

  const input = parsed.data;
  let result: FoodAnalysis;
  try {
    switch (input.mode) {
      case 'barcode':
        result = await resolveCachedFoodAnalysis('open_food_facts', input.barcode, () => lookupOpenFoodFacts(input.barcode));
        break;
      case 'vietnam_database':
        result = await resolveCachedFoodAnalysis(`vietnam_${input.catalog}`, input.query, () => lookupVietnamNutrition(input.query, input.catalog));
        break;
      case 'usda':
        result = await resolveCachedFoodAnalysis('usda_foundation', input.query, () => lookupUsdaFoodData(input.query));
        break;
      case 'text':
        result = (await resolvePersonalFood(user.userId, input.text)) ?? analyseTypedFood(input.text);
        break;
    }
  } catch {
    if (input.mode === 'text') throw new Error('Typed meal analysis could not be completed.');
    result = manualProviderFallback(input);
  }
  let analysis;
  try {
    analysis = await issueMealAnalysisReview(
      user.userId,
      mealReviewDraftSchema.parse(result),
    );
  } catch {
    return Response.json(
      { error: 'The private server review could not be created. No meal was saved; please try again.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return Response.json({ analysis }, { headers: { 'Cache-Control': 'no-store' } });
}
