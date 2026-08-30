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
    expect(findings.every((finding) => finding.ruleVersion === 'meal-starter-rules-2')).toBe(true);
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
});
