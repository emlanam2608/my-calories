import { describe, expect, it } from 'vitest';
import { evaluateMealHealthFindings } from './health-rule-engine';

describe('evaluateMealHealthFindings', () => {
  it('returns no finding when all rule thresholds are avoided', () => {
    expect(evaluateMealHealthFindings({ calories: 299, protein: 20, fiber: 3, sodium: 799 })).toEqual([]);
  });

  it('emits the expected findings at inclusive rule boundaries', () => {
    const findings = evaluateMealHealthFindings({ calories: 750, protein: 20, fiber: 2.9, sodium: 800 });

    expect(findings.map((finding) => finding.ruleCode)).toEqual([
      'meal-sodium-800mg',
      'meal-fiber-under-3g',
      'meal-glucose-fiber-pattern',
      'meal-energy-750kcal',
    ]);
    expect(findings.map((finding) => finding.severity)).toEqual(['attention', 'info', 'info', 'info']);
    expect(findings.every((finding) => finding.ruleVersion === 'meal-starter-rules-6')).toBe(true);
  });

  it('does not treat an exact 3 g of fiber as low fiber', () => {
    const findings = evaluateMealHealthFindings({ calories: 500, protein: 20, fiber: 3, sodium: 0 });

    expect(findings.map((finding) => finding.ruleCode)).toEqual([]);
  });

  it('filters findings to the selected health focuses', () => {
    const findings = evaluateMealHealthFindings(
      { calories: 750, protein: 20, fiber: 2, sodium: 800 },
      ['cholesterol'],
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ condition: 'cholesterol', ruleCode: 'meal-fiber-under-3g' });
  });

  it('surfaces an ingredient-based purine-risk review only for selected uric-acid focus', () => {
    const findings = evaluateMealHealthFindings(
      { calories: 400, protein: 25, fiber: 4, sodium: 300 },
      ['uric_acid'],
      ['Beef', 'Broth', 'Herbs'],
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ condition: 'uric_acid', ruleCode: 'meal-purine-ingredient-signal' });
    expect(findings[0].explanationInputs).toMatchObject({
      kind: 'purine_mapping',
      mappingVersion: 'purine-ingredient-categories-1',
      state: 'matched_with_unresolved',
      matches: [{ normalizedIngredient: 'beef', category: 'red_meat', categoryNameEn: 'Red meat', categoryNameVi: 'Thịt đỏ' }],
      unresolvedIngredients: ['broth'],
    });
  });

  it('uses reported additional nutrients without inferring missing ones', () => {
    const findings = evaluateMealHealthFindings(
      { calories: 500, protein: 20, fiber: 4, sodium: 300 },
      [],
      [],
      {
        carbohydrates: { value: 65, unit: 'g', state: 'reported' },
        addedSugar: { value: 20, unit: 'g', state: 'reported' },
        saturatedFat: { value: 5, unit: 'g', state: 'reported' },
        alcohol: { value: null, unit: 'g', state: 'unavailable' },
      },
    );
    expect(findings.map((finding) => finding.ruleCode)).toEqual([
      'meal-carbohydrates-60g',
      'meal-added-sugar-20g',
      'meal-saturated-fat-5g',
    ]);
    expect(findings[0]).toMatchObject({
      observedValue: 65,
      observedValueState: 'reported',
      observedProvenance: 'nutrition_snapshot_additional',
      targetMetric: null,
      targetAuthority: null,
    });
  });

  it('emits serving-level hydration and micronutrient observations only for available supported units', () => {
    const findings = evaluateMealHealthFindings(
      { calories: 200, protein: 10, fiber: 3, sodium: 100 },
      ['blood_pressure'],
      ['Rice'],
      {
        water: { value: 0, unit: 'ml', state: 'reported' },
        potassium: { value: 420, unit: 'mg', state: 'estimated' },
        calcium: { value: null, unit: 'mg', state: 'unavailable' },
        iron: { value: 0.002, unit: 'g', state: 'reported' },
      },
    );

    expect(findings.map((finding) => finding.ruleCode)).toEqual([
      'meal-water-observed',
      'meal-potassium-observed',
    ]);
    expect(findings[0]).toMatchObject({
      condition: 'general_nutrition', observedValue: 0, observedValueState: 'reported',
      explanationInputs: { kind: 'nutrient_observation', nutrientKey: 'water', sourceState: 'reported', supportedUnit: 'ml' },
    });
    expect(findings[1]).toMatchObject({
      observedValue: 420, observedValueState: 'estimated',
      explanationInputs: { kind: 'nutrient_observation', nutrientKey: 'potassium', sourceState: 'estimated', supportedUnit: 'mg' },
    });
    expect(findings.every((finding) => !/deficient|deficiency diagnosed/i.test(finding.text))).toBe(true);
  });

  it('surfaces unresolved purine recipe data only for the active uric-acid concern', () => {
    const focused = evaluateMealHealthFindings(
      { calories: 200, protein: 10, fiber: 3, sodium: 100 },
      ['uric_acid'],
      ['Food item'],
    );
    expect(focused).toHaveLength(1);
    expect(focused[0]).toMatchObject({
      ruleCode: 'meal-purine-data-unresolved',
      observedValue: null,
      observedValueState: 'unavailable',
      explanationInputs: {
        kind: 'purine_mapping', state: 'unresolved', matches: [], unresolvedIngredients: ['food item'],
      },
    });
    expect(evaluateMealHealthFindings(
      { calories: 200, protein: 10, fiber: 3, sodium: 100 },
      ['cholesterol'],
      ['Food item'],
    )).toEqual([]);
  });

  it('records the effective target value, unit, and clinician authority in each applicable finding', () => {
    const findings = evaluateMealHealthFindings(
      { calories: 800, protein: 10, fiber: 2, sodium: 900 },
      [],
      [],
      undefined,
      [
        { metric: 'calories', value: 1600, unit: 'kcal', authority: 'clinician_defined' },
        { metric: 'protein', value: 110, unit: 'g', authority: 'user_defined' },
        { metric: 'fiber', value: 32, unit: 'g', authority: 'clinician_defined' },
        { metric: 'sodium', value: 1500, unit: 'mg', authority: 'clinician_defined' },
      ],
      'database_derived',
    );

    expect(findings.find((finding) => finding.ruleCode === 'meal-sodium-800mg')).toMatchObject({
      targetMetric: 'sodium', targetValue: 1500, targetUnit: 'mg', targetAuthority: 'clinician_defined',
      observedValue: 900, observedValueState: 'reported', observedProvenance: 'nutrition_snapshot_total',
    });
    expect(findings.find((finding) => finding.ruleCode === 'meal-energy-750kcal')).toMatchObject({
      targetMetric: 'calories', targetValue: 1600, targetAuthority: 'clinician_defined',
    });
    expect(findings.find((finding) => finding.ruleCode === 'meal-protein-under-15g')).toMatchObject({
      observedValue: 10, targetMetric: 'protein', targetValue: 110, targetAuthority: 'user_defined',
    });
  });

  it('flags low protein only when the meal is energy substantial', () => {
    const lowProtein = evaluateMealHealthFindings({ calories: 500, protein: 0, fiber: 4, sodium: 0 });
    expect(lowProtein.map((finding) => finding.ruleCode)).toContain('meal-protein-under-15g');
    expect(lowProtein.find((finding) => finding.ruleCode === 'meal-protein-under-15g')).toMatchObject({
      observedValue: 0,
      observedValueState: 'estimated',
    });
    expect(
      evaluateMealHealthFindings({ calories: 499, protein: 0, fiber: 4, sodium: 0 })
        .map((finding) => finding.ruleCode),
    ).not.toContain('meal-protein-under-15g');
  });
});
