import type { FoodAnalysis } from './contracts';

type FoodTemplate = Omit<FoodAnalysis, 'name' | 'nameVi' | 'mealType' | 'unresolvedQuestions'>;

const templates: Array<{ terms: string[]; value: FoodTemplate }> = [
  { terms: ['phở', 'pho', 'beef noodle'], value: { confidence: 68, snapshot: { totals: { calories: 460, protein: 29, fiber: 3, sodium: 1180 }, servingDescription: '1 medium bowl (estimated)', source: 'manual_estimate', sourceVersion: 'starter-rules-1', estimationLevel: 'estimated', ingredients: ['Rice noodles', 'Beef', 'Broth', 'Herbs'] }, finding: { code: 'sodium-estimate-review', severity: 'attention', text: 'This estimate is broth-dependent. Review the serving and ask for less broth or salty sauce if sodium is a personal focus.' } } },
  { terms: ['cơm', 'com tam', 'rice', 'chicken'], value: { confidence: 62, snapshot: { totals: { calories: 560, protein: 34, fiber: 4, sodium: 760 }, servingDescription: '1 plate (estimated)', source: 'manual_estimate', sourceVersion: 'starter-rules-1', estimationLevel: 'estimated', ingredients: ['Rice', 'Protein', 'Vegetables', 'Seasoning'] }, finding: { code: 'portion-estimate-review', severity: 'info', text: 'Portion size and sauce can change this estimate substantially. Confirm the amount that matches your plate before saving.' } } },
  { terms: ['yogurt', 'sữa chua', 'fruit', 'trái cây'], value: { confidence: 72, snapshot: { totals: { calories: 210, protein: 11, fiber: 5, sodium: 95 }, servingDescription: '1 small bowl (estimated)', source: 'manual_estimate', sourceVersion: 'starter-rules-1', estimationLevel: 'estimated', ingredients: ['Yogurt', 'Fruit', 'Seeds'] }, finding: { code: 'added-sugar-review', severity: 'info', text: 'Check whether the yogurt or topping is sweetened. The values shown are an estimate, not a label-derived result.' } } },
];

const fallback: FoodTemplate = { confidence: 35, snapshot: { totals: { calories: 400, protein: 20, fiber: 3, sodium: 500 }, servingDescription: '1 serving (needs review)', source: 'manual_estimate', sourceVersion: 'starter-rules-1', sourceReference: null, estimationLevel: 'estimated', ingredients: ['Food item'] }, finding: { code: 'manual-review-required', severity: 'attention', text: 'This is a low-confidence starter estimate. Edit the foods and values, or use manual entry, before saving.' } };

export function analyseTypedFood(text: string): FoodAnalysis {
  const normalized = text.toLocaleLowerCase('vi-VN');
  const match = templates.find(({ terms }) => terms.some((term) => normalized.includes(term)))?.value ?? fallback;
  const hour = new Date().getHours();
  const mealType: FoodAnalysis['mealType'] = hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : hour < 21 ? 'dinner' : 'snack';
  return { ...match, name: text.trim(), nameVi: text.trim(), mealType, unresolvedQuestions: match.confidence < 70 ? ['Please review portion size, cooking oil, broth, sauce, and sweetened toppings before saving.'] : [] };
}
