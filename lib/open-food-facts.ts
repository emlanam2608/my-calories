import type { FoodAnalysis } from './contracts';
import { fetchProvider } from './provider-resilience';

type OffProduct = { product_name?: unknown; product_name_vi?: unknown; brands?: unknown; serving_size?: unknown; ingredients_text?: unknown; nutriments?: Record<string, unknown> };
type OffResponse = { status?: unknown; product?: OffProduct };

const fields = 'code,product_name,product_name_vi,brands,serving_size,ingredients_text,nutriments';
const baseUrl = 'https://world.openfoodfacts.org/api/v3/product';

export async function lookupOpenFoodFacts(barcode: string): Promise<FoodAnalysis> {
  const response = await fetchProvider('open_food_facts', `${baseUrl}/${encodeURIComponent(barcode)}?fields=${encodeURIComponent(fields)}`, { headers: { Accept: 'application/json', 'User-Agent': 'Nourishwell/0.1 (https://openai.com)' } });
  if (response.status === 404) return notFoundAnalysis(barcode);
  if (!response.ok) throw new Error('The packaged-food service is temporarily unavailable. Try again later or use typed manual entry.');
  const body = await response.json() as OffResponse;
  if (body.status !== 1 || !body.product) return notFoundAnalysis(barcode);
  return productAnalysis(barcode, body.product);
}

function productAnalysis(barcode: string, product: OffProduct): FoodAnalysis {
  const nutriments = product.nutriments ?? {};
  const servingGrams = grams(product.serving_size);
  const factor = servingGrams ? servingGrams / 100 : 1;
  const perServing = (key: string) => optionalNumber(nutriments[`${key}_serving`]) ?? (optionalNumber(nutriments[`${key}_100g`]) ?? optionalNumber(nutriments[key]) ?? 0) * factor;
  const calories = perServing('energy-kcal');
  const protein = perServing('proteins');
  const fiber = perServing('fiber');
  const sodiumGrams = perServing('sodium');
  const hasNutrition = [calories, protein, fiber, sodiumGrams].some((value) => value > 0);
  const name = text(product.product_name) || `Packaged food ${barcode}`;
  const ingredients = splitIngredients(text(product.ingredients_text));
  return {
    name,
    nameVi: text(product.product_name_vi) || name,
    mealType: inferMealType(),
    confidence: hasNutrition ? 86 : 50,
    unresolvedQuestions: hasNutrition ? ['Confirm the serving shown matches the amount you ate. Product data is community-supplied and may be incomplete.'] : ['Nutrition values were not available from the product record. Enter the label values manually before saving.'],
    snapshot: { totals: { calories, protein, fiber, sodium: Math.round(sodiumGrams * 1_000) }, servingDescription: servingGrams ? `${servingGrams} g serving (product label)` : '100 g label basis (serving not supplied)', source: 'open_food_facts', sourceVersion: 'open-food-facts-api-v3', sourceReference: `${baseUrl}/${barcode}`, barcode, estimationLevel: 'label_derived', ingredients: ingredients.length ? ingredients : ['Packaged food'] },
    finding: { code: hasNutrition ? 'packaged-label-review' : 'packaged-nutrition-missing', severity: hasNutrition ? 'info' : 'attention', text: hasNutrition ? 'Nutrition comes from the packaged-product record. Verify the serving and label against the product in hand before saving.' : 'This product record has no usable nutrition values. Manual label entry is required before this becomes a reliable record.' },
  };
}

function notFoundAnalysis(barcode: string): FoodAnalysis {
  return { name: `Unmatched barcode ${barcode}`, nameVi: `Mã vạch chưa khớp ${barcode}`, mealType: inferMealType(), confidence: 0, unresolvedQuestions: ['No matching packaged-food record was found. Add the nutrition label values manually before saving.'], snapshot: { totals: { calories: 0, protein: 0, fiber: 0, sodium: 0 }, servingDescription: 'Manual label entry required', source: 'manual_entry', sourceVersion: 'manual-entry-1', sourceReference: null, barcode, estimationLevel: 'estimated', ingredients: ['Packaged food'] }, finding: { code: 'barcode-not-found', severity: 'attention', text: 'No trusted packaged-food record was found for this barcode. The empty fields are intentional—enter values from the label to create a confirmed record.' } };
}

function optionalNumber(value: unknown) { const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN; return Number.isFinite(parsed) && parsed >= 0 ? parsed : null; }
function text(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
function grams(value: unknown) { const match = text(value).replace(',', '.').match(/(\d+(?:\.\d+)?)\s*g\b/i); return match ? Number(match[1]) : 0; }
function splitIngredients(value: string) { return value.split(/[,;•]/).map((item) => item.trim()).filter(Boolean).slice(0, 12); }
function inferMealType(): FoodAnalysis['mealType'] { const hour = new Date().getHours(); return hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : hour < 21 ? 'dinner' : 'snack'; }
