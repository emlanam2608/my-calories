import type { HealthFinding, HealthFocus } from './contracts';

type NutrientTotals = { calories: number; protein: number; fiber: number; sodium: number };

const ruleVersion = 'meal-starter-rules-1';
const source = 'Conservative personal-tracking starter rules';

export function evaluateMealHealthFindings(totals: NutrientTotals, activeFocuses: HealthFocus[] = []): HealthFinding[] {
  const findings: HealthFinding[] = [];

  if (totals.sodium >= 800) findings.push({
    condition: 'blood_pressure', severity: 'attention', ruleCode: 'meal-sodium-800mg', ruleVersion,
    observedValue: totals.sodium, observedUnit: 'mg sodium', targetValue: 2_000, targetUnit: 'mg/day', evidenceSource: source,
    text: 'This single serving has a substantial amount of sodium relative to a conservative daily tracking target. This is not a diagnosis or a personal medical limit.',
    suggestedActions: ['Reduce broth, seasoning packets, sauces, and salty side dishes.', 'Compare the label or recipe with the serving you actually ate.'],
  });

  if (totals.fiber < 3 && totals.calories >= 300) findings.push({
    condition: 'cholesterol', severity: 'info', ruleCode: 'meal-fiber-under-3g', ruleVersion,
    observedValue: totals.fiber, observedUnit: 'g fiber', targetValue: 28, targetUnit: 'g/day', evidenceSource: source,
    text: 'This meal is low in fiber for its energy amount. Fiber can be a useful general food-pattern focus for cholesterol support; this is not a treatment recommendation.',
    suggestedActions: ['Add vegetables, beans, fruit, or whole grains when appropriate.', 'Use the day total—not one meal alone—to review progress.'],
  });

  if (totals.calories >= 750) findings.push({
    condition: 'weight_management', severity: 'info', ruleCode: 'meal-energy-750kcal', ruleVersion,
    observedValue: totals.calories, observedUnit: 'kcal', targetValue: null, targetUnit: 'personal target needed', evidenceSource: source,
    text: 'This is an energy-dense serving. Its fit depends on your own daily target, hunger, activity, and clinician guidance.',
    suggestedActions: ['Check portion size and calorie-dense sauces or cooking oil.', 'If helpful, split the serving or pair it with lower-energy vegetables.'],
  });

  return activeFocuses.length ? findings.filter((finding) => activeFocuses.includes(finding.condition as HealthFocus)) : findings;
}
