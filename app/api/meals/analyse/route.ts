import { getChatGPTUser } from '@/app/chatgpt-auth';
import { analyseFoodRequestSchema, foodAnalysisSchema, healthFocusSchema, type FoodAnalysis } from '@/lib/contracts';
import { analyseTypedFood } from '@/lib/food-analysis';
import { lookupOpenFoodFacts } from '@/lib/open-food-facts';
import { lookupVietnamNutrition } from '@/lib/vietnam-nutrition';
import { lookupUsdaFoodData } from '@/lib/usda-fooddata';
import { resolveCachedFoodAnalysis } from '@/lib/food-lookup-cache';
import { evaluateMealHealthFindings } from '@/lib/health-rule-engine';
import { getDb } from '@/db';
import { healthFocuses } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { manualProviderFallback } from '@/lib/provider-fallback';
import { consumeRequestQuota } from '@/lib/request-quota';

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
        result = analyseTypedFood(input.text);
        break;
    }
  } catch {
    if (input.mode === 'text') throw new Error('Typed meal analysis could not be completed.');
    result = manualProviderFallback(input);
  }
  const focusRows = await getDb().select({ focus: healthFocuses.focus }).from(healthFocuses).where(eq(healthFocuses.ownerId, user.userId));
  const focuses = focusRows.flatMap((row) => { const parsedFocus = healthFocusSchema.safeParse(row.focus); return parsedFocus.success ? [parsedFocus.data] : []; });
  const analysis = foodAnalysisSchema.parse({ ...result, healthFindings: evaluateMealHealthFindings(result.snapshot.totals, focuses, result.snapshot.ingredients, result.snapshot.additionalNutrients) });
  return Response.json({ analysis }, { headers: { 'Cache-Control': 'no-store' } });
}
