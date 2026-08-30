import { getChatGPTUser } from '@/app/chatgpt-auth';
import { analyseFoodRequestSchema, foodAnalysisSchema } from '@/lib/contracts';
import { analyseTypedFood } from '@/lib/food-analysis';
import { lookupOpenFoodFacts } from '@/lib/open-food-facts';
import { lookupVietnamNutrition } from '@/lib/vietnam-nutrition';
import { lookupUsdaFoodData } from '@/lib/usda-fooddata';
import { resolveCachedFoodAnalysis } from '@/lib/food-lookup-cache';
import { evaluateMealHealthFindings } from '@/lib/health-rule-engine';
import { getDb } from '@/db';
import { healthFocuses } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { healthFocusSchema } from '@/lib/contracts';

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = analyseFoodRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Enter a meal description or an 8–14 digit barcode.' }, { status: 400 });

  let result;
  switch (parsed.data.mode) {
    case 'barcode':
      {
        const barcode = parsed.data.barcode;
        result = await resolveCachedFoodAnalysis('open_food_facts', barcode, () => lookupOpenFoodFacts(barcode));
      }
      break;
    case 'vietnam_database':
      {
        const { catalog, query } = parsed.data;
        result = await resolveCachedFoodAnalysis(`vietnam_${catalog}`, query, () => lookupVietnamNutrition(query, catalog));
      }
      break;
    case 'usda':
      {
        const query = parsed.data.query;
        result = await resolveCachedFoodAnalysis('usda_foundation', query, () => lookupUsdaFoodData(query));
      }
      break;
    case 'text':
      result = analyseTypedFood(parsed.data.text);
      break;
  }
  const focusRows = await getDb().select({ focus: healthFocuses.focus }).from(healthFocuses).where(eq(healthFocuses.ownerId, user.userId));
  const focuses = focusRows.flatMap((row) => { const parsedFocus = healthFocusSchema.safeParse(row.focus); return parsedFocus.success ? [parsedFocus.data] : []; });
  const analysis = foodAnalysisSchema.parse({ ...result, healthFindings: evaluateMealHealthFindings(result.snapshot.totals, focuses) });
  return Response.json({ analysis }, { headers: { 'Cache-Control': 'no-store' } });
}
