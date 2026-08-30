import type { FoodAnalysis } from './contracts';
import { fetchProvider } from './provider-resilience';

type ProviderRecord = Record<string, unknown>;
type ProviderPage = { data?: unknown };

const baseUrl = 'https://viendinhduong.vn/api/fe';
const sourceVersion = 'viendinhduong-portal-api-2026-08';

export async function lookupVietnamNutrition(query: string, catalog: 'ingredient' | 'dish'): Promise<FoodAnalysis> {
  const endpoint = catalog === 'ingredient' ? 'foodNatunal/getPageFoodData' : 'tool/getPageFoodData';
  const url = new URL(`${baseUrl}/${endpoint}`);
  url.search = new URLSearchParams({ page: '1', pageSize: '8', name: query, energy: '0' }).toString();
  const response = await fetchProvider('vietnam_nutrition', url, { headers: { Accept: 'application/json', 'User-Agent': 'Nourishwell/0.1 (https://openai.com)' } });
  if (!response.ok) throw new Error('The Vietnam nutrition service is temporarily unavailable. Try again later or use typed manual entry.');
  const page = await response.json() as ProviderPage;
  const records = Array.isArray(page.data) ? page.data.filter(isRecord) : [];
  if (!records.length) return noMatch(query, catalog, url.toString());
  return analysisFromRecord(records[0], catalog, url.toString(), records.length);
}

function analysisFromRecord(record: ProviderRecord, catalog: 'ingredient' | 'dish', sourceReference: string, matchCount: number): FoodAnalysis {
  const nameVi = string(record.name_vi) || string(record.name) || 'Thực phẩm chưa có tên';
  const nameEn = string(record.name_en) || nameVi;
  const components = asRecords(catalog === 'ingredient' ? record.nutrition : record.nutritional_components);
  const nutrients = mapNutrients(components);
  const directEnergy = numeric(record.energy) || numeric(record.total_energy);
  const calories = nutrients.calories || directEnergy;
  const ingredients = catalog === 'dish' ? componentNames(asRecords(record.dish_components)) : [string(record.category) || 'Vietnam food catalog'];
  const hasNutrition = calories > 0 || nutrients.protein > 0 || nutrients.fiber > 0 || nutrients.sodium > 0;
  return {
    name: nameEn,
    nameVi,
    mealType: inferMealType(),
    confidence: hasNutrition ? 78 : 48,
    unresolvedQuestions: [`The first of ${matchCount} matching ${catalog === 'ingredient' ? 'ingredient' : 'dish'} records is shown. Confirm the food and serving before saving.`, ...(hasNutrition ? [] : ['The selected record did not expose usable nutrient components. Enter the values manually before saving.'])],
    snapshot: { totals: { calories, protein: nutrients.protein, fiber: nutrients.fiber, sodium: nutrients.sodium }, servingDescription: catalog === 'ingredient' ? '100 g database basis' : 'Database dish basis; serving needs confirmation', source: 'vietnam_institute_nutrition', sourceVersion, sourceReference, estimationLevel: 'database_derived', ingredients: ingredients.length ? ingredients : [nameVi] },
    finding: { code: hasNutrition ? 'vietnam-catalog-review' : 'vietnam-catalog-values-missing', severity: hasNutrition ? 'info' : 'attention', text: hasNutrition ? 'Nutrients come from a Vietnam nutrition catalog result. Database basis and your actual serving can differ, so review every value before saving.' : 'A matching Vietnam catalog record was found, but usable nutrient values were unavailable. Add the nutrition values manually before saving.' },
  };
}

function noMatch(query: string, catalog: 'ingredient' | 'dish', sourceReference: string): FoodAnalysis {
  return { name: query, nameVi: query, mealType: inferMealType(), confidence: 0, unresolvedQuestions: [`No ${catalog === 'ingredient' ? 'ingredient' : 'dish'} match was found. Use manual values or try a shorter Vietnamese name.`], snapshot: { totals: { calories: 0, protein: 0, fiber: 0, sodium: 0 }, servingDescription: 'Manual entry required', source: 'manual_entry', sourceVersion: 'manual-entry-1', sourceReference, estimationLevel: 'estimated', ingredients: [query] }, finding: { code: 'vietnam-catalog-not-found', severity: 'attention', text: 'No verified catalog match was found. Empty fields are intentional—enter values from a trusted source before saving.' } };
}

function mapNutrients(components: ProviderRecord[]) {
  const result = { calories: 0, protein: 0, fiber: 0, sodium: 0 };
  for (const component of components) {
    const label = [component.name_vi, component.name_en, component.name, component.nutrient, component.component_name, component.description].map(string).join(' ').toLocaleLowerCase('vi-VN');
    const value = numeric(component.value) || numeric(component.amount) || numeric(component.quantity) || numeric(component.nutrition_value) || numeric(component.content);
    const unit = string(component.unit).toLowerCase();
    if (!value) continue;
    if (/(năng lượng|energy|calorie|kcal)/.test(label)) result.calories ||= toCalories(value, unit);
    else if (/(protein|protid|đạm)/.test(label)) result.protein ||= value;
    else if (/(fiber|fibre|chất xơ|xơ)/.test(label)) result.fiber ||= value;
    else if (/(sodium|natri|\bna\b)/.test(label)) result.sodium ||= unit === 'g' ? value * 1000 : value;
  }
  return result;
}

function toCalories(value: number, unit: string) { return /kj/.test(unit) ? Math.round(value / 4.184) : value; }
function componentNames(items: ProviderRecord[]) { return items.map((item) => string(item.name_vi) || string(item.name) || string(item.food_name)).filter(Boolean).slice(0, 12); }
function asRecords(value: unknown) { return Array.isArray(value) ? value.filter(isRecord) : []; }
function isRecord(value: unknown): value is ProviderRecord { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function string(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
function numeric(value: unknown) { const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(',', '.')) : 0; return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0; }
function inferMealType(): FoodAnalysis['mealType'] { const hour = new Date().getHours(); return hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : hour < 21 ? 'dinner' : 'snack'; }
