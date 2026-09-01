import type { FoodAnalysis } from './contracts';

export const provenanceConcepts = [
  'user_confirmed_fact',
  'provider_database_value',
  'estimate',
  'deterministic_rule',
  'ai_explanation',
] as const;

export type ProvenanceConcept = (typeof provenanceConcepts)[number];
export type ProvenanceStatus = 'present' | 'pending' | 'absent';

export function reviewProvenanceStates(analysis: FoodAnalysis): Array<{
  concept: ProvenanceConcept;
  status: ProvenanceStatus;
}> {
  const providerValue = analysis.snapshot.source === 'open_food_facts'
    || analysis.snapshot.source === 'vietnam_institute_nutrition'
    || analysis.snapshot.source === 'usda_fooddata_central';
  return [
    {
      concept: 'user_confirmed_fact',
      status: analysis.snapshot.estimationLevel === 'user_confirmed' ? 'present' : 'pending',
    },
    { concept: 'provider_database_value', status: providerValue ? 'present' : 'absent' },
    { concept: 'estimate', status: analysis.snapshot.estimationLevel === 'estimated' ? 'present' : 'absent' },
    { concept: 'deterministic_rule', status: analysis.healthFindings?.length ? 'present' : 'absent' },
    // No current FoodAnalysis contract can carry AI-authored coaching prose.
    { concept: 'ai_explanation', status: 'absent' },
  ];
}

export function reviewNoteOrigin(analysis: FoodAnalysis): 'provider_note' | 'estimate_note' | 'user_library_note' {
  if (analysis.snapshot.source === 'manual_entry' && analysis.snapshot.estimationLevel === 'user_confirmed')
    return 'user_library_note';
  if (analysis.snapshot.source === 'manual_estimate' || analysis.snapshot.estimationLevel === 'estimated')
    return 'estimate_note';
  return 'provider_note';
}

export function snapshotValueState(analysis: FoodAnalysis): 'user_confirmed' | 'provider_database' | 'estimate' {
  if (analysis.snapshot.estimationLevel === 'user_confirmed') return 'user_confirmed';
  if (analysis.snapshot.estimationLevel === 'estimated') return 'estimate';
  return 'provider_database';
}
