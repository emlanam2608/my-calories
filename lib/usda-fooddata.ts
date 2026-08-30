import { env } from 'cloudflare:workers';
import type { FoodAnalysis } from './contracts';
import { fetchProvider } from './provider-resilience';

type UsdaNutrient = Record<string, unknown>;
type UsdaFood = { fdcId?: unknown; description?: unknown; dataType?: unknown; foodNutrients?: unknown; foodCategory?: unknown; additionalDescriptions?: unknown };
type UsdaSearchResponse = { foods?: unknown };

const baseUrl = 'https://api.nal.usda.gov/fdc/v1/foods/search';

export async function lookupUsdaFoodData(query: string): Promise<FoodAnalysis> {
  const key = env.USDA_FDC_API_KEY?.trim();
  if (!key) throw new Error('USDA lookup is not configured yet. Add USDA_FDC_API_KEY in private runtime settings, or use Vietnam data/manual entry.');
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({ api_key: key, query, pageSize: '5', dataType: 'Foundation' }).toString();
  const response = await fetchProvider('usda_fooddata', url, { headers: { Accept: 'application/json' } });
  if (response.status === 429) throw new Error('USDA lookup is temporarily rate-limited. Try again later or use manual entry.');
  if (!response.ok) throw new Error('USDA lookup is temporarily unavailable. Try again later or use manual entry.');
  const body = await response.json() as UsdaSearchResponse;
  const foods = Array.isArray(body.foods) ? body.foods.filter(isFood) : [];
  if (!foods.length) return noMatch(query, url.toString());
  return analysisFromFood(foods[0], foods.length);
}

function analysisFromFood(food: UsdaFood, matchCount: number): FoodAnalysis {
  const nutrients = Array.isArray(food.foodNutrients) ? food.foodNutrients.filter(isRecord) : [];
  const totals = mapNutrients(nutrients);
  const name = text(food.description) || 'USDA food result';
  const fdcId = text(food.fdcId);
  return { name, nameVi: name, mealType: inferMealType(), confidence: totals.calories || totals.protein || totals.fiber || totals.sodium ? 84 : 50, unresolvedQuestions: [`The first of ${matchCount} USDA search results is shown. Confirm the food and amount before saving.`], snapshot: { totals, servingDescription: '100 g USDA database basis', source: 'usda_fooddata_central', sourceVersion: 'usda-fdc-api-v1', sourceReference: fdcId ? `https://fdc.nal.usda.gov/food-details/${fdcId}/nutrients` : 'https://fdc.nal.usda.gov/', estimationLevel: 'database_derived', ingredients: [text(food.foodCategory) || text(food.dataType) || 'USDA FoodData Central'] }, finding: { code: 'usda-database-review', severity: 'info', text: 'Nutrients come from a USDA database result on a 100 g basis. Confirm the exact food and your serving before saving.' } };
}

function noMatch(query: string, sourceReference: string): FoodAnalysis {
  return { name: query, nameVi: query, mealType: inferMealType(), confidence: 0, unresolvedQuestions: ['No USDA food match was found. Use Vietnam data or enter trusted values manually.'], snapshot: { totals: { calories: 0, protein: 0, fiber: 0, sodium: 0 }, servingDescription: 'Manual entry required', source: 'manual_entry', sourceVersion: 'manual-entry-1', sourceReference, estimationLevel: 'estimated', ingredients: [query] }, finding: { code: 'usda-not-found', severity: 'attention', text: 'No verified USDA match was found. Empty fields are intentional—enter values from a trusted source before saving.' } };
}

function mapNutrients(nutrients: UsdaNutrient[]) {
  const totals = { calories: 0, protein: 0, fiber: 0, sodium: 0 };
  for (const nutrient of nutrients) {
    const label = [nutrient.nutrientName, nutrient.name, isRecord(nutrient.nutrient) ? nutrient.nutrient.name : ''].map(text).join(' ').toLowerCase();
    const value = numeric(nutrient.value) || numeric(nutrient.amount);
    const unit = text(nutrient.unitName || nutrient.unit || (isRecord(nutrient.nutrient) ? nutrient.nutrient.unitName : '')).toLowerCase();
    if (!value) continue;
    if (/(energy|calorie)/.test(label)) totals.calories ||= unit === 'kj' ? Math.round(value / 4.184) : value;
    else if (/protein/.test(label)) totals.protein ||= value;
    else if (/(fiber|fibre)/.test(label)) totals.fiber ||= value;
    else if (/sodium/.test(label)) totals.sodium ||= unit === 'g' ? value * 1000 : unit === 'µg' ? value / 1000 : value;
  }
  return totals;
}

function isFood(value: unknown): value is UsdaFood { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function text(value: unknown) { return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : ''; }
function numeric(value: unknown) { const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(',', '.')) : 0; return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0; }
function inferMealType(): FoodAnalysis['mealType'] { const hour = new Date().getHours(); return hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : hour < 21 ? 'dinner' : 'snack'; }
