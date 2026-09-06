import type { FoodAnalysis, HealthFinding, HealthFocus } from './contracts';
import { defaultEffectiveTargets, type EffectiveTarget, type TargetMetric } from './targets';
import { readNutrient, type AvailableNutrient } from './nutrient-availability';
import { mapPurineIngredients } from './purine-categories';
import { localizedFindingPresentation } from './health-finding-presentation';

type NutrientTotals = { calories: number; protein: number; fiber: number; sodium: number };
type AdditionalNutrients = FoodAnalysis['snapshot']['additionalNutrients'];
type EstimationLevel = FoodAnalysis['snapshot']['estimationLevel'];
type FindingObservation = Pick<HealthFinding, 'observedValue' | 'observedUnit' | 'observedValueState' | 'observedProvenance'>;
type FindingTarget = Pick<HealthFinding, 'targetMetric' | 'targetValue' | 'targetUnit' | 'targetAuthority'>;

const ruleVersion = 'meal-starter-rules-7';
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
    ...localizedFindingPresentation(
      'This single serving has a substantial amount of sodium relative to your effective daily tracking target. This is not a diagnosis or a personal medical limit.',
      'Khẩu phần này có lượng natri đáng kể so với mục tiêu theo dõi hằng ngày đang áp dụng của bạn. Đây không phải là chẩn đoán hay giới hạn y khoa cá nhân.',
      [
        { en: 'Reduce broth, seasoning packets, sauces, and salty side dishes.', vi: 'Giảm nước dùng, gói gia vị, nước xốt và món ăn kèm nhiều muối.' },
        { en: 'Compare the label or recipe with the serving you actually ate.', vi: 'Đối chiếu nhãn hoặc công thức với khẩu phần bạn thực sự đã ăn.' },
      ],
    ),
  });

  const carbohydrates = readNutrient(additionalNutrients, 'carbohydrates');
  if (totals.fiber < 3 && totals.calories >= 300 && carbohydrates.state !== 'available') findings.push({
    condition: 'cholesterol', severity: 'info', ruleCode: 'meal-fiber-under-3g', ruleVersion,
    ...totalObservation(totals.fiber, 'g fiber', estimationLevel), ...targetFields(effectiveTargets, 'fiber'), evidenceSource: source,
    ...localizedFindingPresentation(
      'This meal is low in fiber for its energy amount. Fiber can be a useful general food-pattern focus for cholesterol support; this is not a treatment recommendation.',
      'Bữa ăn này có ít chất xơ so với mức năng lượng. Chất xơ có thể là một trọng tâm chung của chế độ ăn để hỗ trợ cholesterol; đây không phải là khuyến nghị điều trị.',
      [
        { en: 'Add vegetables, beans, fruit, or whole grains when appropriate.', vi: 'Thêm rau, các loại đậu, trái cây hoặc ngũ cốc nguyên hạt khi phù hợp.' },
        { en: 'Use the day total—not one meal alone—to review progress.', vi: 'Đánh giá tiến triển bằng tổng cả ngày, không chỉ một bữa ăn.' },
      ],
    ),
  });

  if (carbohydrates.state === 'available' && carbohydrates.value >= 60) findings.push({
    condition: 'blood_glucose', severity: 'info', ruleCode: 'meal-carbohydrates-60g', ruleVersion,
    ...nutrientObservation(carbohydrates), ...targetFields(effectiveTargets, null), evidenceSource: 'ADA food and blood glucose educational guidance',
    ...localizedFindingPresentation(
      'This serving has a substantial amount of available carbohydrate. The app cannot predict glucose response or medication needs from a meal record.',
      'Khẩu phần này có lượng carbohydrate sẵn có đáng kể. Ứng dụng không thể dự đoán đáp ứng đường huyết hoặc nhu cầu thuốc từ một bản ghi bữa ăn.',
      [
        { en: 'Review the serving, carbohydrate source, and fiber together.', vi: 'Xem xét đồng thời khẩu phần, nguồn carbohydrate và chất xơ.' },
        { en: 'Use your own glucose checks and clinician guidance for individualized decisions.', vi: 'Dựa vào kết quả đo đường huyết của bạn và hướng dẫn của bác sĩ cho các quyết định cá nhân.' },
      ],
    ),
  });

  const addedSugar = readNutrient(additionalNutrients, 'addedSugar');
  if (addedSugar.state === 'available' && addedSugar.value >= 20) findings.push({
    condition: 'weight_management', severity: 'info', ruleCode: 'meal-added-sugar-20g', ruleVersion,
    ...nutrientObservation(addedSugar), ...targetFields(effectiveTargets, null), evidenceSource: source,
    ...localizedFindingPresentation(
      'This serving has a notable amount of available added sugar. This is a tracking observation, not a diagnosis or treatment recommendation.',
      'Khẩu phần này có lượng đường bổ sung sẵn có đáng chú ý. Đây là nhận xét để theo dõi, không phải chẩn đoán hay khuyến nghị điều trị.',
      [
        { en: 'Check whether a smaller serving or an unsweetened alternative fits your goals.', vi: 'Cân nhắc khẩu phần nhỏ hơn hoặc lựa chọn không đường nếu phù hợp với mục tiêu của bạn.' },
        { en: 'Compare the label with the amount you actually ate.', vi: 'Đối chiếu nhãn với lượng bạn thực sự đã ăn.' },
      ],
    ),
  });

  const saturatedFat = readNutrient(additionalNutrients, 'saturatedFat');
  if (saturatedFat.state === 'available' && saturatedFat.value >= 5) findings.push({
    condition: 'cholesterol', severity: 'info', ruleCode: 'meal-saturated-fat-5g', ruleVersion,
    ...nutrientObservation(saturatedFat), ...targetFields(effectiveTargets, null), evidenceSource: source,
    ...localizedFindingPresentation(
      'This serving has a notable amount of available saturated fat. One meal does not determine cholesterol health or treatment needs.',
      'Khẩu phần này có lượng chất béo bão hòa sẵn có đáng chú ý. Một bữa ăn không quyết định tình trạng cholesterol hoặc nhu cầu điều trị.',
      [
        { en: 'Review portions and compare lower-saturated-fat alternatives when useful.', vi: 'Xem lại khẩu phần và so sánh lựa chọn ít chất béo bão hòa hơn khi hữu ích.' },
        { en: 'Use the wider food pattern and clinician guidance for decisions.', vi: 'Dựa vào chế độ ăn tổng thể và hướng dẫn của bác sĩ khi đưa ra quyết định.' },
      ],
    ),
  });

  if (totals.fiber < 3 && totals.calories >= 300) findings.push({
    condition: 'blood_glucose', severity: 'info', ruleCode: 'meal-glucose-fiber-pattern', ruleVersion,
    ...totalObservation(totals.fiber, 'g fiber', estimationLevel), ...targetFields(effectiveTargets, 'fiber'), evidenceSource: 'ADA food and blood glucose educational guidance',
    ...localizedFindingPresentation(
      'This is a lower-fiber meal pattern. The app does not have complete response or medication information, so this is not a glucose prediction or dosing recommendation.',
      'Đây là kiểu bữa ăn ít chất xơ. Ứng dụng không có đầy đủ thông tin về đáp ứng hoặc thuốc, vì vậy đây không phải dự đoán đường huyết hay khuyến nghị liều dùng.',
      [
        { en: 'When this meal includes carbohydrates, pair it with vegetables, beans, or another fiber-rich food.', vi: 'Khi bữa ăn có carbohydrate, hãy kết hợp với rau, các loại đậu hoặc thực phẩm giàu chất xơ khác.' },
        { en: 'Use your own glucose checks and clinician guidance to learn how this meal affects you.', vi: 'Dùng kết quả đo đường huyết của bạn và hướng dẫn của bác sĩ để hiểu bữa ăn ảnh hưởng đến bạn thế nào.' },
      ],
    ),
  });

  if (totals.calories >= 750) findings.push({
    condition: 'weight_management', severity: 'info', ruleCode: 'meal-energy-750kcal', ruleVersion,
    ...totalObservation(totals.calories, 'kcal', estimationLevel), ...targetFields(effectiveTargets, 'calories'), evidenceSource: source,
    ...localizedFindingPresentation(
      'This is an energy-dense serving. Its fit depends on your effective daily target, hunger, activity, and clinician guidance.',
      'Đây là khẩu phần có mật độ năng lượng cao. Mức độ phù hợp phụ thuộc vào mục tiêu hằng ngày đang áp dụng, cảm giác đói, hoạt động và hướng dẫn của bác sĩ.',
      [
        { en: 'Check portion size and calorie-dense sauces or cooking oil.', vi: 'Kiểm tra khẩu phần cùng các loại xốt hoặc dầu nấu ăn giàu năng lượng.' },
        { en: 'If helpful, split the serving or pair it with lower-energy vegetables.', vi: 'Nếu hữu ích, chia nhỏ khẩu phần hoặc kết hợp với rau có năng lượng thấp hơn.' },
      ],
    ),
  });

  if (totals.protein < 15 && totals.calories >= 500) findings.push({
    condition: 'weight_management', severity: 'info', ruleCode: 'meal-protein-under-15g', ruleVersion,
    ...totalObservation(totals.protein, 'g protein', estimationLevel), ...targetFields(effectiveTargets, 'protein'), evidenceSource: source,
    ...localizedFindingPresentation(
      'This serving has relatively little available protein for its energy amount. Whether it fits your needs depends on your total day, preferences, activity, and clinician guidance.',
      'Khẩu phần này có tương đối ít protein sẵn có so với mức năng lượng. Mức độ phù hợp phụ thuộc vào tổng cả ngày, sở thích, hoạt động và hướng dẫn của bác sĩ.',
      [
        { en: 'If it suits your eating pattern, add a protein-rich food and check the serving size.', vi: 'Nếu phù hợp với cách ăn của bạn, hãy thêm thực phẩm giàu protein và kiểm tra khẩu phần.' },
        { en: 'Review your daily protein target rather than judging one meal alone.', vi: 'Đánh giá mục tiêu protein hằng ngày thay vì chỉ nhận xét một bữa ăn.' },
      ],
    ),
  });

  const nutrientObservations = [
    {
      key: 'water' as const, units: ['g', 'ml'] as const, code: 'meal-water-observed', labelEn: 'water', labelVi: 'nước',
      actionEn: 'Use this as a serving-level hydration record, not a daily hydration assessment.',
      actionVi: 'Dùng giá trị này như bản ghi nước ở cấp khẩu phần, không phải đánh giá lượng nước cả ngày.',
    },
    {
      key: 'potassium' as const, units: ['mg'] as const, code: 'meal-potassium-observed', labelEn: 'potassium', labelVi: 'kali',
      actionEn: 'Review this value as part of the wider food pattern and any clinician guidance.',
      actionVi: 'Xem giá trị này trong chế độ ăn tổng thể và cùng mọi hướng dẫn của bác sĩ.',
    },
    {
      key: 'calcium' as const, units: ['mg'] as const, code: 'meal-calcium-observed', labelEn: 'calcium', labelVi: 'canxi',
      actionEn: 'Review the day or week pattern rather than judging adequacy from one serving.',
      actionVi: 'Xem xét chế độ ăn theo ngày hoặc tuần thay vì đánh giá mức đầy đủ từ một khẩu phần.',
    },
    {
      key: 'iron' as const, units: ['mg'] as const, code: 'meal-iron-observed', labelEn: 'iron', labelVi: 'sắt',
      actionEn: 'Review the day or week pattern rather than judging adequacy from one serving.',
      actionVi: 'Xem xét chế độ ăn theo ngày hoặc tuần thay vì đánh giá mức đầy đủ từ một khẩu phần.',
    },
  ];
  for (const definition of nutrientObservations) {
    const nutrient = readNutrient(additionalNutrients, definition.key, definition.units);
    if (nutrient.state !== 'available') continue;
    findings.push({
      condition: 'general_nutrition', severity: 'info', ruleCode: definition.code, ruleVersion,
      ...nutrientObservation(nutrient), ...targetFields(effectiveTargets, null), evidenceSource: 'Confirmed nutrition snapshot source value',
      explanationInputs: { kind: 'nutrient_observation', nutrientKey: definition.key, sourceState: nutrient.sourceState, supportedUnit: nutrient.unit },
      ...localizedFindingPresentation(
        `The source reports ${nutrient.value} ${nutrient.unit} of ${definition.labelEn} for this serving. This observation does not assess daily adequacy or diagnose a deficiency.`,
        `Nguồn dữ liệu ghi nhận ${nutrient.value} ${nutrient.unit} ${definition.labelVi} cho khẩu phần này. Nhận xét này không đánh giá mức đầy đủ hằng ngày hoặc chẩn đoán thiếu hụt.`,
        [
          { en: 'Confirm the serving and source unit.', vi: 'Xác nhận khẩu phần và đơn vị của nguồn dữ liệu.' },
          { en: definition.actionEn, vi: definition.actionVi },
        ],
      ),
    });
  }

  const purineMapping = mapPurineIngredients(ingredients);
  if (purineMapping.matches.length) findings.push({
    condition: 'uric_acid', severity: 'attention', ruleCode: 'meal-purine-ingredient-signal', ruleVersion,
    observedValue: purineMapping.matches.length, observedUnit: 'category matches', observedValueState: 'reported', observedProvenance: 'ingredient_list',
    ...targetFields(effectiveTargets, null), evidenceSource: 'American College of Rheumatology gout patient guidance',
    explanationInputs: { kind: 'purine_mapping', ...purineMapping },
    ...localizedFindingPresentation(
      `The ingredient list contains ${purineMapping.matches.length} mapped purine-risk category match${purineMapping.matches.length === 1 ? '' : 'es'}. Confirm the recipe and portion: categories cannot measure purines or predict a flare.`,
      `Danh sách thành phần có ${purineMapping.matches.length} kết quả khớp với nhóm nguy cơ purine đã lập bản đồ. Hãy xác nhận công thức và khẩu phần: các nhóm này không thể đo purine hoặc dự đoán đợt bùng phát.`,
      [
        { en: 'If this is a regular choice, consider a lower-purine protein or a meal with more vegetables.', vi: 'Nếu đây là lựa chọn thường xuyên, hãy cân nhắc nguồn protein ít purine hơn hoặc bữa ăn có nhiều rau hơn.' },
        { en: 'Follow your clinician’s plan during a gout flare or if you have symptoms.', vi: 'Tuân theo kế hoạch của bác sĩ trong đợt gout bùng phát hoặc khi bạn có triệu chứng.' },
      ],
    ),
  });
  else if (activeFocuses.includes('uric_acid')) findings.push({
    condition: 'uric_acid', severity: 'info', ruleCode: 'meal-purine-data-unresolved', ruleVersion,
    observedValue: null, observedUnit: 'ingredient detail', observedValueState: 'unavailable', observedProvenance: 'ingredient_list',
    ...targetFields(effectiveTargets, null), evidenceSource: 'Versioned ingredient-category mapping',
    explanationInputs: { kind: 'purine_mapping', ...purineMapping },
    ...localizedFindingPresentation(
      'The available ingredient detail cannot resolve a purine-risk category. This is missing recipe information, not a low-purine result.',
      'Chi tiết thành phần hiện có không đủ để xác định nhóm nguy cơ purine. Đây là thiếu thông tin công thức, không phải kết quả ít purine.',
      [
        { en: 'Confirm the main protein, broth, and seafood ingredients.', vi: 'Xác nhận nguồn protein chính, nước dùng và các thành phần hải sản.' },
        { en: 'Use clinician guidance and symptoms rather than treating missing recipe detail as safe.', vi: 'Dựa vào hướng dẫn của bác sĩ và triệu chứng thay vì xem chi tiết công thức bị thiếu là an toàn.' },
      ],
    ),
  });

  const alcohol = readNutrient(additionalNutrients, 'alcohol');
  if (alcohol.state === 'available' && alcohol.value > 0) findings.push({
    condition: 'uric_acid', severity: 'info', ruleCode: 'meal-alcohol-reported', ruleVersion,
    ...nutrientObservation(alcohol), ...targetFields(effectiveTargets, null), evidenceSource: 'American College of Rheumatology gout patient guidance',
    ...localizedFindingPresentation(
      'Alcohol was available for this serving. The app cannot predict uric-acid changes or a flare from this record alone.',
      'Khẩu phần này có dữ liệu về cồn. Ứng dụng không thể dự đoán thay đổi axit uric hoặc đợt bùng phát chỉ từ bản ghi này.',
      [
        { en: 'Confirm the serving and follow any clinician guidance about alcohol.', vi: 'Xác nhận khẩu phần và tuân theo mọi hướng dẫn của bác sĩ về đồ uống có cồn.' },
        { en: 'Use symptom and measurement trends rather than a single meal to review patterns.', vi: 'Dùng xu hướng triệu chứng và số đo thay vì một bữa ăn để xem xét quy luật.' },
      ],
    ),
  });

  return activeFocuses.length
    ? findings.filter((finding) => finding.condition === 'general_nutrition' || activeFocuses.includes(finding.condition as HealthFocus))
    : findings;
}
