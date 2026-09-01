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
    expect(findings.every((finding) => finding.ruleVersion === 'meal-starter-rules-4')).toBe(true);
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
  });

  it('flags low protein only when the meal is energy substantial', () => {
    expect(
      evaluateMealHealthFindings({ calories: 500, protein: 14.9, fiber: 4, sodium: 0 })
        .map((finding) => finding.ruleCode),
    ).toContain('meal-protein-under-15g');
    expect(
      evaluateMealHealthFindings({ calories: 499, protein: 0, fiber: 4, sodium: 0 })
        .map((finding) => finding.ruleCode),
    ).not.toContain('meal-protein-under-15g');
  });
});
