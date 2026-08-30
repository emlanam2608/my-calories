import type { FoodAnalysis } from './contracts';

type ProviderInput =
  | { mode: 'barcode'; barcode: string }
  | { mode: 'vietnam_database'; query: string; catalog: 'ingredient' | 'dish' }
  | { mode: 'usda'; query: string };

export function manualProviderFallback(input: ProviderInput): FoodAnalysis {
  const name = input.mode === 'barcode' ? `Unverified barcode ${input.barcode}` : input.query;
  const provider = input.mode === 'barcode' ? 'barcode provider' : input.mode === 'usda' ? 'USDA provider' : 'Vietnam nutrition provider';
  return {
    name,
    nameVi: name,
    mealType: inferMealType(),
    confidence: 0,
    unresolvedQuestions: [`The ${provider} is temporarily unavailable. Enter values from the food label or another trusted source before saving.`],
    snapshot: {
      totals: { calories: 0, protein: 0, fiber: 0, sodium: 0 },
      servingDescription: 'Manual entry required after provider outage',
      source: 'manual_entry',
      sourceVersion: 'manual-entry-1',
      sourceReference: null,
      ...(input.mode === 'barcode' ? { barcode: input.barcode } : {}),
      estimationLevel: 'estimated',
      ingredients: [name],
    },
    finding: {
      code: 'provider-unavailable-manual-review',
      severity: 'attention',
      text: 'No nutrient value was returned because the provider is temporarily unavailable. The blank fields are intentional and must be reviewed before saving.',
    },
  };
}

function inferMealType(): FoodAnalysis['mealType'] {
  const hour = new Date().getHours();
  return hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : hour < 21 ? 'dinner' : 'snack';
}
