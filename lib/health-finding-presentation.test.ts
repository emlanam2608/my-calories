import { describe, expect, it } from 'vitest';
import { healthFindingSchema } from './contracts';
import {
  localizedFindingPresentation,
  presentHealthFinding,
} from './health-finding-presentation';

const commonFinding = {
  condition: 'blood_pressure' as const,
  severity: 'attention' as const,
  ruleCode: 'test-rule',
  ruleVersion: 'test-1',
  observedValue: 800,
  observedUnit: 'mg sodium',
  observedValueState: 'reported' as const,
  observedProvenance: 'nutrition_snapshot_total' as const,
  targetMetric: 'sodium' as const,
  targetValue: 1500,
  targetUnit: 'mg',
  targetAuthority: 'clinician_defined' as const,
  evidenceSource: 'Test evidence',
};

describe('health finding presentation', () => {
  it('persists and selects both languages from the versioned snapshot', () => {
    const finding = healthFindingSchema.parse({
      ...commonFinding,
      ...localizedFindingPresentation(
        'English explanation.',
        'Giải thích tiếng Việt.',
        [{ en: 'English action.', vi: 'Hành động tiếng Việt.' }],
      ),
    });

    expect(presentHealthFinding(finding, 'en')).toEqual({
      text: 'English explanation.',
      suggestedActions: ['English action.'],
      usedLegacyEnglishFallback: false,
    });
    expect(presentHealthFinding(finding, 'vi')).toEqual({
      text: 'Giải thích tiếng Việt.',
      suggestedActions: ['Hành động tiếng Việt.'],
      usedLegacyEnglishFallback: false,
    });
  });

  it('parses old English-only snapshots without rewriting them', () => {
    const finding = healthFindingSchema.parse({
      ...commonFinding,
      text: 'Historical English explanation.',
      suggestedActions: ['Historical English action.'],
    });

    expect(presentHealthFinding(finding, 'en').usedLegacyEnglishFallback).toBe(false);
    expect(presentHealthFinding(finding, 'vi')).toEqual({
      text: 'Historical English explanation.',
      suggestedActions: ['Historical English action.'],
      usedLegacyEnglishFallback: true,
    });
  });
});
