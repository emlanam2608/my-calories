import { Badge } from '@/components/ui/badge';
import type { FoodAnalysis, HealthFinding } from '@/lib/contracts';
import { getCopy, type Locale } from '@/lib/copy';
import { presentHealthFinding } from '@/lib/health-finding-presentation';
import { reviewNoteOrigin, reviewProvenanceStates, snapshotValueState } from '@/lib/meal-provenance';

const additionalKeys = [
  'carbohydrates', 'totalSugar', 'addedSugar', 'totalFat', 'saturatedFat',
  'cholesterol', 'potassium', 'calcium', 'iron', 'alcohol', 'water',
] as const;

export function MealProvenancePanel({
  analysis,
  locale,
  aiAssistedInput,
}: {
  analysis: FoodAnalysis;
  locale: Locale;
  aiAssistedInput: boolean;
}) {
  const c = getCopy(locale).mealCapture;
  const conceptLabels = {
    user_confirmed_fact: c.userConfirmedFacts,
    provider_database_value: c.providerDatabaseValues,
    estimate: c.estimatedValues,
    deterministic_rule: c.deterministicRuleResults,
    ai_explanation: c.aiWrittenExplanations,
  } as const;
  const statusLabels = {
    present: c.provenancePresent,
    pending: c.provenancePending,
    absent: c.provenanceAbsent,
  } as const;
  const sourceLabels = {
    manual_estimate: c.manualEstimate,
    manual_entry: c.manualEntryValue,
    open_food_facts: c.openFoodFacts,
    vietnam_institute_nutrition: c.vietnamNutrition,
    usda_fooddata_central: c.usdaFoodData,
  } as const;
  const basisLabels = {
    estimated: c.estimated,
    database_derived: c.databaseDerived,
    label_derived: c.labelDerived,
    user_confirmed: c.userConfirmed,
  } as const;
  const coreState = snapshotValueState(analysis);
  const valueStateLabels = {
    user_confirmed: c.userConfirmed,
    provider_database: c.providerDatabaseValues,
    estimate: c.estimated,
  } as const;
  const nutrientLabels = {
    calories: getCopy(locale).today.calories,
    protein: getCopy(locale).today.protein,
    fiber: getCopy(locale).today.fiber,
    sodium: getCopy(locale).today.sodium,
    carbohydrates: c.carbohydrates,
    totalSugar: c.totalSugar,
    addedSugar: c.addedSugar,
    totalFat: c.totalFat,
    saturatedFat: c.saturatedFat,
    cholesterol: c.cholesterol,
    potassium: c.potassium,
    calcium: c.calcium,
    iron: c.iron,
    alcohol: c.alcohol,
    water: c.water,
  } as const;
  const coreUnits = { calories: 'kcal', protein: 'g', fiber: 'g', sodium: 'mg' } as const;

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4" aria-labelledby="meal-provenance-title">
      <h2 id="meal-provenance-title" className="text-sm font-semibold text-slate-900">{c.provenanceTitle}</h2>
      <p className="mt-1 text-xs leading-5 text-slate-600">{c.provenanceDescription}</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2" aria-label={c.provenanceTitle}>
        {reviewProvenanceStates(analysis).map((item) => (
          <li key={item.concept} className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs">
            <span className="font-medium text-slate-700">{conceptLabels[item.concept]}</span>
            <Badge variant={item.status === 'present' ? 'secondary' : 'outline'}>{statusLabels[item.status]}</Badge>
          </li>
        ))}
      </ul>
      {aiAssistedInput ? <p className="mt-3 rounded-xl bg-violet-50 p-3 text-xs leading-5 text-violet-950">{c.aiExtractionDisclosure}</p> : null}

      <h3 className="mt-5 text-sm font-semibold text-slate-900">{c.sourceDetails}</h3>
      <dl className="mt-2 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-[minmax(8rem,auto)_1fr]">
        <dt className="text-slate-500">{c.source}</dt><dd className="break-words font-medium text-slate-800">{sourceLabels[analysis.snapshot.source] ?? c.unavailable}</dd>
        <dt className="text-slate-500">{c.sourceVersion}</dt><dd className="break-all font-medium text-slate-800">{analysis.snapshot.sourceVersion || c.unavailable}</dd>
        <dt className="text-slate-500">{c.sourceReference}</dt><dd className="break-all font-medium text-slate-800">{analysis.snapshot.sourceReference || c.unavailable}</dd>
        <dt className="text-slate-500">{c.estimationLevel}</dt><dd className="font-medium text-slate-800">{basisLabels[analysis.snapshot.estimationLevel]}</dd>
        <dt className="text-slate-500">{c.confidenceLabel}</dt><dd className="font-medium text-slate-800">{analysis.confidence}%</dd>
      </dl>

      <details className="mt-5 rounded-xl bg-slate-50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2">
          {c.nutrientAvailability}
        </summary>
        <p className="mt-2 text-xs leading-5 text-slate-600">{c.nutrientAvailabilityDescription}</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {(Object.keys(coreUnits) as Array<keyof typeof coreUnits>).map((key) => (
            <li key={key} className="rounded-lg bg-white p-3 text-xs">
              <div className="flex items-center justify-between gap-2"><span className="font-medium">{nutrientLabels[key]}</span><Badge variant="outline">{valueStateLabels[coreState]}</Badge></div>
              <p className="mt-1 text-slate-600">{analysis.snapshot.totals[key].toLocaleString(locale)} {coreUnits[key]}</p>
            </li>
          ))}
          {additionalKeys.map((key) => {
            const nutrient = analysis.snapshot.additionalNutrients?.[key];
            const available = nutrient && nutrient.value !== null && nutrient.state !== 'unavailable';
            return (
              <li key={key} className="rounded-lg bg-white p-3 text-xs">
                <div className="flex items-center justify-between gap-2"><span className="font-medium">{nutrientLabels[key]}</span><Badge variant="outline">{available ? (nutrient.state === 'estimated' ? c.estimated : c.reported) : c.unavailable}</Badge></div>
                <p className="mt-1 text-slate-600">{available ? `${nutrient.value!.toLocaleString(locale)} ${nutrient.unit}` : '—'}</p>
              </li>
            );
          })}
        </ul>
      </details>
    </section>
  );
}

export function MealFindingProvenance({ finding, locale }: { finding: HealthFinding; locale: Locale }) {
  const c = getCopy(locale).mealCapture;
  const presentation = presentHealthFinding(finding, locale);
  const conditionLabels = {
    weight_management: c.weightManagementFinding,
    blood_pressure: c.bloodPressureFinding,
    cholesterol: c.cholesterolFinding,
    blood_glucose: c.bloodGlucoseFinding,
    uric_acid: c.uricAcidFinding,
    general_nutrition: c.generalNutrition,
  } as const;
  const stateLabels = { reported: c.reported, estimated: c.estimated, unavailable: c.unavailable } as const;
  const observedLabels = {
    nutrition_snapshot_total: c.nutritionSnapshotTotal,
    nutrition_snapshot_additional: c.nutritionSnapshotAdditional,
    ingredient_list: c.ingredientListEvidence,
  } as const;
  const authorityLabels = {
    guideline_default: c.guidelineDefault,
    user_defined: c.userDefined,
    clinician_defined: c.clinicianDefined,
  } as const;
  const purine = finding.explanationInputs?.kind === 'purine_mapping' ? finding.explanationInputs : null;
  return (
    <div className={`mt-3 rounded-xl border p-4 text-sm ${finding.severity === 'attention' ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">{conditionLabels[finding.condition]} · {finding.observedValue === null ? '—' : finding.observedValue.toLocaleString(locale)} {finding.observedUnit}</p>
        <Badge variant="outline">{c.deterministicRuleResults}</Badge>
      </div>
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide opacity-70">{c.deterministicExplanation}</p>
      <p className="mt-1 leading-6">{presentation.text}</p>
      <ul className="mt-2 list-disc pl-5">{presentation.suggestedActions.map((action) => <li key={action}>{action}</li>)}</ul>
      {presentation.usedLegacyEnglishFallback ? <p className="mt-2 text-xs opacity-75">{c.legacyEnglishFinding}</p> : null}
      <dl className="mt-3 grid gap-x-4 gap-y-1 border-t border-current/10 pt-3 text-xs sm:grid-cols-[minmax(9rem,auto)_1fr]">
        <dt className="opacity-70">{c.ruleLabel}</dt><dd className="break-all">{finding.ruleCode} · {finding.ruleVersion}</dd>
        <dt className="opacity-70">{c.observedProvenance}</dt><dd>{observedLabels[finding.observedProvenance]} · {stateLabels[finding.observedValueState]}</dd>
        <dt className="opacity-70">{c.effectiveTarget}</dt><dd>{finding.targetMetric && finding.targetValue !== null && finding.targetUnit ? `${finding.targetMetric}: ${finding.targetValue.toLocaleString(locale)} ${finding.targetUnit}` : c.noEffectiveTarget}</dd>
        <dt className="opacity-70">{c.targetAuthority}</dt><dd>{finding.targetAuthority ? authorityLabels[finding.targetAuthority] : c.unavailable}</dd>
        <dt className="opacity-70">{c.evidenceSource}</dt><dd>{finding.evidenceSource}</dd>
      </dl>
      {purine ? (
        <div className="mt-3 rounded-lg bg-white/60 p-3 text-xs">
          <p className="font-semibold">{c.purineEvidence}</p>
          {purine.matches.length ? <ul className="mt-1 list-disc pl-5">{purine.matches.map((match) => <li key={`${match.normalizedIngredient}-${match.category}`}>{match.normalizedIngredient} · {locale === 'vi' ? match.categoryNameVi : match.categoryNameEn}</li>)}</ul> : null}
          {purine.unresolvedIngredients.length ? <p className="mt-2"><span className="font-medium">{c.unresolvedEvidence}:</span> {purine.unresolvedIngredients.join(', ')}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function ReviewNoteLabel({ analysis, locale }: { analysis: FoodAnalysis; locale: Locale }) {
  const c = getCopy(locale).mealCapture;
  const labels = { provider_note: c.providerReviewNote, estimate_note: c.estimateReviewNote, user_library_note: c.userLibraryReviewNote } as const;
  return <><p className="font-semibold">{labels[reviewNoteOrigin(analysis)]}</p><p className="mt-1 text-xs opacity-75">{c.notAiExplanation}</p></>;
}
