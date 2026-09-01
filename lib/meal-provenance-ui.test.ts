import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MealFindingProvenance, MealProvenancePanel } from '@/components/dashboard/meal-provenance-panel';
import type { FoodAnalysis } from './contracts';
import { getCopy } from './copy';
import { evaluateMealHealthFindings } from './health-rule-engine';

function fixture(): FoodAnalysis {
  const snapshot: FoodAnalysis['snapshot'] = {
    totals: { calories: 500, protein: 20, fiber: 4, sodium: 900 },
    servingDescription: '100 g database basis', source: 'usda_fooddata_central',
    sourceVersion: 'usda-test-v1', sourceReference: null, estimationLevel: 'database_derived',
    ingredients: ['rice'], additionalNutrients: { potassium: { value: 0, unit: 'mg', state: 'reported' } },
  };
  return {
    name: 'Test meal', nameVi: 'Bữa ăn thử', mealType: 'lunch', confidence: 84,
    unresolvedQuestions: [], snapshot,
    finding: { code: 'provider-review', severity: 'info', text: 'Review the provider serving.' },
    healthFindings: evaluateMealHealthFindings(snapshot.totals, ['blood_pressure'], snapshot.ingredients, snapshot.additionalNutrients, [
      { metric: 'calories', value: 1800, unit: 'kcal', authority: 'guideline_default' },
      { metric: 'protein', value: 90, unit: 'g', authority: 'guideline_default' },
      { metric: 'fiber', value: 28, unit: 'g', authority: 'guideline_default' },
      { metric: 'sodium', value: 1500, unit: 'mg', authority: 'clinician_defined' },
    ], snapshot.estimationLevel),
  };
}

describe('meal provenance review UI', () => {
  it('renders all five source concepts, missing provenance, AI extraction disclosure, and keyboard-expandable nutrient states', () => {
    const analysis = fixture();
    for (const locale of ['en', 'vi'] as const) {
      const c = getCopy(locale).mealCapture;
      const html = renderToStaticMarkup(createElement(MealProvenancePanel, { analysis, locale, aiAssistedInput: true }));
      for (const label of [c.userConfirmedFacts, c.providerDatabaseValues, c.estimatedValues, c.deterministicRuleResults, c.aiWrittenExplanations])
        expect(html).toContain(label);
      expect(html).toContain(c.provenancePending);
      expect(html).toContain(c.provenanceAbsent);
      expect(html).toContain(c.aiExtractionDisclosure);
      expect(html).toContain(c.unavailable);
      expect(html).toContain('<details');
      expect(html).toContain('<summary');
      expect(html).toContain('aria-labelledby="meal-provenance-title"');
      expect(html).toContain('sm:grid-cols-2');
      expect(html).toContain('0 mg');
    }
  });

  it('renders rule/version/evidence, clinician target authority, and observed provenance separately', () => {
    const finding = fixture().healthFindings![0];
    for (const locale of ['en', 'vi'] as const) {
      const c = getCopy(locale).mealCapture;
      const html = renderToStaticMarkup(createElement(MealFindingProvenance, { finding, locale }));
      expect(html).toContain(c.deterministicRuleResults);
      expect(html).toContain(c.observedProvenance);
      expect(html).toContain(c.effectiveTarget);
      expect(html).toContain(c.clinicianDefined);
      expect(html).toContain(c.evidenceSource);
      expect(html).toContain('meal-sodium-800mg');
      expect(html).toContain('meal-starter-rules-6');
    }
  });

  it('preserves the existing editable review and explicit confirmation boundary', () => {
    const capture = readFileSync(new URL('../components/dashboard/capture-surface.tsx', import.meta.url), 'utf8');
    expect(capture).toContain('onNutrientChange');
    expect(capture).toContain('onReviewDetailsChange');
    expect(capture).toContain('onClick={onConfirm}');
    expect(capture).toContain('c.mealCapture.confirmAndSave');
    expect(capture).not.toContain('localStorage');
  });
});
