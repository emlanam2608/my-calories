import type { FoodAnalysis, HealthFinding, HealthFocus } from './contracts';
import { defaultEffectiveTargets, type EffectiveTarget, type TargetMetric } from './targets';
import { readNutrient, type AvailableNutrient } from './nutrient-availability';
import { mapPurineIngredients } from './purine-categories';

type NutrientTotals = { calories: number; protein: number; fiber: number; sodium: number };
type AdditionalNutrients = FoodAnalysis['snapshot']['additionalNutrients'];
type EstimationLevel = FoodAnalysis['snapshot']['estimationLevel'];
type FindingObservation = Pick<HealthFinding, 'observedValue' | 'observedUnit' | 'observedValueState' | 'observedProvenance'>;
type FindingTarget = Pick<HealthFinding, 'targetMetric' | 'targetValue' | 'targetUnit' | 'targetAuthority'>;

const ruleVersion = 'meal-starter-rules-6';
const source = 'Conservative personal-tracking starter rules';

function totalObservation(value: number, unit: string, estimationLevel: EstimationLevel): FindingObservation {
  return {
    observedValue: value,
    observedUnit: unit,
    observedValueState: estimationLevel === 'estimated' ? 'estimated' : 'reported',
    observedProvenance: 'nutrition_snapshot_total',
  };
}

function nutrientObservation(nutrient: AvailableNutrient): FindingObservation {
  return {
    observedValue: nutrient.value, observedUnit: nutrient.unit,
    observedValueState: nutrient.sourceState,
    observedProvenance: 'nutrition_snapshot_additional',
  };
}

function targetFields(targets: EffectiveTarget[], metric: TargetMetric | null): FindingTarget {
  const target = metric ? targets.find((candidate) => candidate.metric === metric) : undefined;
  return target
    ? { targetMetric: target.metric, targetValue: target.value, targetUnit: target.unit, targetAuthority: target.authority }
    : { targetMetric: null, targetValue: null, targetUnit: null, targetAuthority: null };
}

export function evaluateMealHealthFindings(
  totals: NutrientTotals,
  activeFocuses: HealthFocus[] = [],
  ingredients: string[] = [],
  additionalNutrients?: AdditionalNutrients,
  effectiveTargets: EffectiveTarget[] = defaultEffectiveTargets,
  estimationLevel: EstimationLevel = 'estimated',
): HealthFinding[] {
  const findings: HealthFinding[] = [];

  if (totals.sodium >= 800) findings.push({
    condition: 'blood_pressure', severity: 'attention', ruleCode: 'meal-sodium-800mg', ruleVersion,
    ...totalObservation(totals.sodium, 'mg sodium', estimationLevel), ...targetFields(effectiveTargets, 'sodium'), evidenceSource: source,
    text: 'This single serving has a substantial amount of sodium relative to your effective daily tracking target. This is not a diagnosis or a personal medical limit.',
    suggestedActions: ['Reduce broth, seasoning packets, sauces, and salty side dishes.', 'Compare the label or recipe with the serving you actually ate.'],
  });

  const carbohydrates = readNutrient(additionalNutrients, 'carbohydrates');
  if (totals.fiber < 3 && totals.calories >= 300 && carbohydrates.state !== 'available') findings.push({
    condition: 'cholesterol', severity: 'info', ruleCode: 'meal-fiber-under-3g', ruleVersion,
    ...totalObservation(totals.fiber, 'g fiber', estimationLevel), ...targetFields(effectiveTargets, 'fiber'), evidenceSource: source,
    text: 'This meal is low in fiber for its energy amount. Fiber can be a useful general food-pattern focus for cholesterol support; this is not a treatment recommendation.',
    suggestedActions: ['Add vegetables, beans, fruit, or whole grains when appropriate.', 'Use the day total—not one meal alone—to review progress.'],
  });

  if (carbohydrates.state === 'available' && carbohydrates.value >= 60) findings.push({
    condition: 'blood_glucose', severity: 'info', ruleCode: 'meal-carbohydrates-60g', ruleVersion,
    ...nutrientObservation(carbohydrates), ...targetFields(effectiveTargets, null), evidenceSource: 'ADA food and blood glucose educational guidance',
    text: 'This serving has a substantial amount of available carbohydrate. The app cannot predict glucose response or medication needs from a meal record.',
    suggestedActions: ['Review the serving, carbohydrate source, and fiber together.', 'Use your own glucose checks and clinician guidance for individualized decisions.'],
  });

  const addedSugar = readNutrient(additionalNutrients, 'addedSugar');
  if (addedSugar.state === 'available' && addedSugar.value >= 20) findings.push({
    condition: 'weight_management', severity: 'info', ruleCode: 'meal-added-sugar-20g', ruleVersion,
    ...nutrientObservation(addedSugar), ...targetFields(effectiveTargets, null), evidenceSource: source,
    text: 'This serving has a notable amount of available added sugar. This is a tracking observation, not a diagnosis or treatment recommendation.',
    suggestedActions: ['Check whether a smaller serving or an unsweetened alternative fits your goals.', 'Compare the label with the amount you actually ate.'],
  });

  const saturatedFat = readNutrient(additionalNutrients, 'saturatedFat');
  if (saturatedFat.state === 'available' && saturatedFat.value >= 5) findings.push({
    condition: 'cholesterol', severity: 'info', ruleCode: 'meal-saturated-fat-5g', ruleVersion,
    ...nutrientObservation(saturatedFat), ...targetFields(effectiveTargets, null), evidenceSource: source,
    text: 'This serving has a notable amount of available saturated fat. One meal does not determine cholesterol health or treatment needs.',
    suggestedActions: ['Review portions and compare lower-saturated-fat alternatives when useful.', 'Use the wider food pattern and clinician guidance for decisions.'],
  });

  if (totals.fiber < 3 && totals.calories >= 300) findings.push({
    condition: 'blood_glucose', severity: 'info', ruleCode: 'meal-glucose-fiber-pattern', ruleVersion,
    ...totalObservation(totals.fiber, 'g fiber', estimationLevel), ...targetFields(effectiveTargets, 'fiber'), evidenceSource: 'ADA food and blood glucose educational guidance',
    text: 'This is a lower-fiber meal pattern. The app does not have complete response or medication information, so this is not a glucose prediction or dosing recommendation.',
    suggestedActions: ['When this meal includes carbohydrates, pair it with vegetables, beans, or another fiber-rich food.', 'Use your own glucose checks and clinician guidance to learn how this meal affects you.'],
  });

  if (totals.calories >= 750) findings.push({
    condition: 'weight_management', severity: 'info', ruleCode: 'meal-energy-750kcal', ruleVersion,
    ...totalObservation(totals.calories, 'kcal', estimationLevel), ...targetFields(effectiveTargets, 'calories'), evidenceSource: source,
    text: 'This is an energy-dense serving. Its fit depends on your effective daily target, hunger, activity, and clinician guidance.',
    suggestedActions: ['Check portion size and calorie-dense sauces or cooking oil.', 'If helpful, split the serving or pair it with lower-energy vegetables.'],
  });

  if (totals.protein < 15 && totals.calories >= 500) findings.push({
    condition: 'weight_management', severity: 'info', ruleCode: 'meal-protein-under-15g', ruleVersion,
    ...totalObservation(totals.protein, 'g protein', estimationLevel), ...targetFields(effectiveTargets, 'protein'), evidenceSource: source,
    text: 'This serving has relatively little available protein for its energy amount. Whether it fits your needs depends on your total day, preferences, activity, and clinician guidance.',
    suggestedActions: ['If it suits your eating pattern, add a protein-rich food and check the serving size.', 'Review your daily protein target rather than judging one meal alone.'],
  });

  const nutrientObservations = [
    { key: 'water' as const, units: ['g', 'ml'] as const, code: 'meal-water-observed', label: 'water', action: 'Use this as a serving-level hydration record, not a daily hydration assessment.' },
    { key: 'potassium' as const, units: ['mg'] as const, code: 'meal-potassium-observed', label: 'potassium', action: 'Review this value as part of the wider food pattern and any clinician guidance.' },
    { key: 'calcium' as const, units: ['mg'] as const, code: 'meal-calcium-observed', label: 'calcium', action: 'Review the day or week pattern rather than judging adequacy from one serving.' },
    { key: 'iron' as const, units: ['mg'] as const, code: 'meal-iron-observed', label: 'iron', action: 'Review the day or week pattern rather than judging adequacy from one serving.' },
  ];
  for (const definition of nutrientObservations) {
    const nutrient = readNutrient(additionalNutrients, definition.key, definition.units);
    if (nutrient.state !== 'available') continue;
    findings.push({
      condition: 'general_nutrition', severity: 'info', ruleCode: definition.code, ruleVersion,
      ...nutrientObservation(nutrient), ...targetFields(effectiveTargets, null), evidenceSource: 'Confirmed nutrition snapshot source value',
      explanationInputs: { kind: 'nutrient_observation', nutrientKey: definition.key, sourceState: nutrient.sourceState, supportedUnit: nutrient.unit },
      text: `The source reports ${nutrient.value} ${nutrient.unit} of ${definition.label} for this serving. This observation does not assess daily adequacy or diagnose a deficiency.`,
      suggestedActions: ['Confirm the serving and source unit.', definition.action],
    });
  }

  const purineMapping = mapPurineIngredients(ingredients);
  if (purineMapping.matches.length) findings.push({
    condition: 'uric_acid', severity: 'attention', ruleCode: 'meal-purine-ingredient-signal', ruleVersion,
    observedValue: purineMapping.matches.length, observedUnit: 'category matches', observedValueState: 'reported', observedProvenance: 'ingredient_list',
    ...targetFields(effectiveTargets, null), evidenceSource: 'American College of Rheumatology gout patient guidance',
    explanationInputs: { kind: 'purine_mapping', ...purineMapping },
    text: `The ingredient list contains ${purineMapping.matches.length} mapped purine-risk category match${purineMapping.matches.length === 1 ? '' : 'es'}. Confirm the recipe and portion: categories cannot measure purines or predict a flare.`,
    suggestedActions: ['If this is a regular choice, consider a lower-purine protein or a meal with more vegetables.', 'Follow your clinician’s plan during a gout flare or if you have symptoms.'],
  });
  else if (activeFocuses.includes('uric_acid')) findings.push({
    condition: 'uric_acid', severity: 'info', ruleCode: 'meal-purine-data-unresolved', ruleVersion,
    observedValue: null, observedUnit: 'ingredient detail', observedValueState: 'unavailable', observedProvenance: 'ingredient_list',
    ...targetFields(effectiveTargets, null), evidenceSource: 'Versioned ingredient-category mapping',
    explanationInputs: { kind: 'purine_mapping', ...purineMapping },
    text: 'The available ingredient detail cannot resolve a purine-risk category. This is missing recipe information, not a low-purine result.',
    suggestedActions: ['Confirm the main protein, broth, and seafood ingredients.', 'Use clinician guidance and symptoms rather than treating missing recipe detail as safe.'],
  });

  const alcohol = readNutrient(additionalNutrients, 'alcohol');
  if (alcohol.state === 'available' && alcohol.value > 0) findings.push({
    condition: 'uric_acid', severity: 'info', ruleCode: 'meal-alcohol-reported', ruleVersion,
    ...nutrientObservation(alcohol), ...targetFields(effectiveTargets, null), evidenceSource: 'American College of Rheumatology gout patient guidance',
    text: 'Alcohol was available for this serving. The app cannot predict uric-acid changes or a flare from this record alone.',
    suggestedActions: ['Confirm the serving and follow any clinician guidance about alcohol.', 'Use symptom and measurement trends rather than a single meal to review patterns.'],
  });

  return activeFocuses.length
    ? findings.filter((finding) => finding.condition === 'general_nutrition' || activeFocuses.includes(finding.condition as HealthFocus))
    : findings;
}
