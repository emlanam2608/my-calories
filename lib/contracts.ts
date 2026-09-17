import { z } from 'zod';
import {
  canonicalMeasurementUnits,
  isSupportedMeasurementUnit,
  type ConvertibleMeasurementMetric,
} from './measurement-conversions';
import { workoutReadinessFlagKeys } from './workout-readiness';

export const nutrientTotalsSchema = z.object({
  calories: z.number().finite().min(0).max(10_000),
  protein: z.number().finite().min(0).max(1_000),
  fiber: z.number().finite().min(0).max(1_000),
  sodium: z.number().finite().min(0).max(100_000),
});
const healthFindingBaseShape = {
  condition: z.enum([
    'weight_management',
    'blood_pressure',
    'cholesterol',
    'blood_glucose',
    'uric_acid',
    'general_nutrition',
  ]),
  severity: z.enum(['info', 'attention']),
  ruleCode: z.string().trim().min(1).max(80),
  ruleVersion: z.string().trim().min(1).max(40),
  observedValue: z.number().finite().min(0).nullable(),
  observedUnit: z.string().trim().min(1).max(16),
  observedValueState: z.enum(['reported', 'estimated', 'unavailable']),
  observedProvenance: z.enum([
    'nutrition_snapshot_total',
    'nutrition_snapshot_additional',
    'ingredient_list',
  ]),
  targetMetric: z.enum(['calories', 'protein', 'fiber', 'sodium']).nullable(),
  targetValue: z.number().finite().min(0).nullable(),
  targetUnit: z.string().trim().min(1).max(16).nullable(),
  targetAuthority: z
    .enum(['guideline_default', 'user_defined', 'clinician_defined'])
    .nullable(),
  explanationInputs: z
    .discriminatedUnion('kind', [
      z
        .object({
          kind: z.literal('nutrient_observation'),
          nutrientKey: z.enum(['water', 'potassium', 'calcium', 'iron']),
          sourceState: z.enum(['reported', 'estimated']),
          supportedUnit: z.string().trim().min(1).max(16),
        })
        .strict(),
      z
        .object({
          kind: z.literal('purine_mapping'),
          mappingVersion: z.string().trim().min(1).max(80),
          state: z.enum(['matched', 'matched_with_unresolved', 'unresolved']),
          matches: z
            .array(
              z
                .object({
                  normalizedIngredient: z.string().trim().min(1).max(120),
                  category: z.enum([
                    'organ_meat',
                    'red_meat',
                    'small_oily_fish',
                    'shellfish',
                    'concentrated_meat_broth',
                  ]),
                  categoryNameEn: z.string().trim().min(1).max(80),
                  categoryNameVi: z.string().trim().min(1).max(80),
                })
                .strict(),
            )
            .max(24),
          unresolvedIngredients: z
            .array(z.string().trim().min(1).max(120))
            .max(24),
        })
        .strict(),
    ])
    .optional(),
  evidenceSource: z.string().trim().min(1).max(160),
};
const legacyHealthFindingSchema = z.object({
  ...healthFindingBaseShape,
  text: z.string().trim().min(1).max(500),
  suggestedActions: z.array(z.string().trim().min(1).max(180)).min(1).max(3),
});
const localizedFindingTextSchema = z
  .object({
    en: z.string().trim().min(1).max(500),
    vi: z.string().trim().min(1).max(500),
  })
  .strict();
const localizedFindingActionSchema = z
  .object({
    en: z.string().trim().min(1).max(180),
    vi: z.string().trim().min(1).max(180),
  })
  .strict();
const localizedHealthFindingSchema = z.object({
  ...healthFindingBaseShape,
  presentationVersion: z.literal('health-finding-presentation-1'),
  text: localizedFindingTextSchema,
  suggestedActions: z.array(localizedFindingActionSchema).min(1).max(3),
});
export const healthFindingSchema = z
  .union([localizedHealthFindingSchema, legacyHealthFindingSchema])
  .superRefine((value, context) => {
    if (
      value.observedValueState === 'unavailable' &&
      value.observedValue !== null
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['observedValue'],
        message: 'Unavailable findings must not contain an observed value.',
      });
    if (
      value.observedValueState !== 'unavailable' &&
      value.observedValue === null
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['observedValue'],
        message: 'Available findings require an observed value.',
      });
    const hasTarget = value.targetMetric !== null;
    if (
      hasTarget !==
      (value.targetValue !== null &&
        value.targetUnit !== null &&
        value.targetAuthority !== null)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetMetric'],
        message:
          'Target metric, value, unit, and authority must be present or absent together.',
      });
  });
export const healthFocusSchema = z.enum([
  'blood_pressure',
  'cholesterol',
  'blood_glucose',
  'uric_acid',
]);
export const additionalNutrientKeySchema = z.enum([
  'carbohydrates',
  'totalSugar',
  'addedSugar',
  'totalFat',
  'saturatedFat',
  'cholesterol',
  'potassium',
  'calcium',
  'iron',
  'alcohol',
  'water',
]);
export const additionalNutrientSchema = z
  .object({
    value: z.number().finite().min(0).nullable(),
    unit: z.string().trim().min(1).max(16),
    state: z.enum(['reported', 'estimated', 'unavailable']),
  })
  .superRefine((value, context) => {
    if (value.state === 'unavailable' && value.value !== null)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Unavailable nutrients must not contain a value.',
      });
    if (value.state !== 'unavailable' && value.value === null)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Available nutrients require a value.',
      });
  });
export const additionalNutrientsSchema = z
  .record(additionalNutrientKeySchema, additionalNutrientSchema)
  .optional();
export const nutritionSnapshotSchema = z.object({
  totals: nutrientTotalsSchema,
  servingDescription: z.string().trim().min(1).max(160),
  source: z.enum([
    'manual_estimate',
    'manual_entry',
    'open_food_facts',
    'vietnam_institute_nutrition',
    'usda_fooddata_central',
  ]),
  sourceVersion: z.string().trim().min(1).max(64),
  sourceReference: z.string().trim().min(1).max(500).nullable().optional(),
  barcode: z
    .string()
    .regex(/^\d{8,14}$/)
    .optional(),
  estimationLevel: z.enum([
    'estimated',
    'database_derived',
    'label_derived',
    'user_confirmed',
  ]),
  ingredients: z.array(z.string().trim().min(1).max(120)).min(1).max(24),
  additionalNutrients: additionalNutrientsSchema,
});
export const mealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export const mealServerReviewSchema = z
  .object({
    id: z.string().uuid(),
    expiresAt: z.string().datetime({ offset: true }),
  })
  .strict();
export const foodAnalysisSchema = z.object({
  name: z.string().trim().min(1).max(160),
  nameVi: z.string().trim().min(1).max(160),
  mealType: mealTypeSchema,
  confidence: z.number().int().min(0).max(100),
  unresolvedQuestions: z.array(z.string().trim().min(1).max(180)).max(4),
  snapshot: nutritionSnapshotSchema,
  finding: z.object({
    code: z.string().trim().min(1).max(80),
    severity: z.enum(['info', 'attention']),
    text: z.string().trim().min(1).max(500),
  }),
  healthFindings: z.array(healthFindingSchema).max(16).optional(),
  serverReview: mealServerReviewSchema.nullable().optional(),
});
export const mealReviewDraftSchema = foodAnalysisSchema.omit({
  healthFindings: true,
  serverReview: true,
});
export const reviewedMealAnalysisSchema = foodAnalysisSchema.extend({
  healthFindings: z.array(healthFindingSchema).max(16),
  serverReview: mealServerReviewSchema.nullable().optional(),
});
export const createMealReviewRequestSchema = z
  .object({
    analysis: mealReviewDraftSchema,
  })
  .strict();
export const analyseFoodRequestSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('text'),
    text: z.string().trim().min(3).max(1_000),
  }),
  z.object({
    mode: z.literal('barcode'),
    barcode: z
      .string()
      .trim()
      .regex(/^\d{8,14}$/, 'Enter an 8–14 digit barcode.'),
  }),
  z.object({
    mode: z.literal('vietnam_database'),
    query: z.string().trim().min(2).max(160),
    catalog: z.enum(['ingredient', 'dish']),
  }),
  z.object({
    mode: z.literal('usda'),
    query: z.string().trim().min(2).max(160),
  }),
]);
export const foodExtractionItemSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    nameVi: z.string().trim().min(1).max(160),
    grams: z.number().finite().min(1).max(5_000).nullable(),
    servingDescription: z.string().trim().min(1).max(160),
    preparation: z.string().trim().min(1).max(160).nullable(),
    ingredients: z.array(z.string().trim().min(1).max(120)).max(24),
    barcode: z
      .string()
      .regex(/^\d{8,14}$/)
      .nullable(),
    confidence: z.number().int().min(0).max(100),
  })
  .strict();
export const foodExtractionProposalSchema = z
  .object({
    items: z.array(foodExtractionItemSchema).min(1).max(12),
    confidence: z.number().int().min(0).max(100),
    unresolvedQuestions: z.array(z.string().trim().min(1).max(180)).max(4),
    manualReviewRequired: z.boolean(),
  })
  .strict();
export const extractFoodRequestSchema = z
  .object({ uploadId: z.string().uuid() })
  .strict();
export const foodExtractionResponseSchema = z
  .object({
    proposal: foodExtractionProposalSchema,
    model: z.string().trim().min(1).max(100),
    promptVersion: z.string().trim().min(1).max(40),
    schemaVersion: z.string().trim().min(1).max(40),
  })
  .strict();
export const savedFoodKindSchema = z.enum(['food', 'recipe']);
export const savePersonalFoodRequestSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    kind: savedFoodKindSchema,
    name: z.string().trim().min(1).max(160),
    nameVi: z.string().trim().min(1).max(160),
    nutritionSnapshot: nutritionSnapshotSchema,
  })
  .strict();
export const savedFoodSchema = z
  .object({
    id: z.string().uuid(),
    kind: savedFoodKindSchema,
    name: z.string().trim().min(1).max(160),
    nameVi: z.string().trim().min(1).max(160),
    nutritionSnapshot: nutritionSnapshotSchema,
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();
export const savedFoodsResponseSchema = z.object({
  savedFoods: z.array(savedFoodSchema).max(100),
});
export const deleteSavedFoodRequestSchema = z
  .object({ idempotencyKey: z.string().uuid() })
  .strict();
export const createMealRequestSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    reviewId: z.string().uuid(),
    occurredAt: z.string().datetime({ offset: true }),
  })
  .strict();
export const profileLocaleSchema = z.enum(['en', 'vi']);
export const profileTargetsResponseSchema = z.object({
  locale: profileLocaleSchema,
  targets: z.array(
    z.object({
      metric: z.enum(['calories', 'protein', 'fiber', 'sodium']),
      value: z.number().finite().min(0),
      unit: z.string().min(1),
      authority: z.enum([
        'guideline_default',
        'user_defined',
        'clinician_defined',
      ]),
    }),
  ),
});
export const updateProfileTargetsRequestSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    targets: z
      .array(
        z.object({
          metric: z.enum(['calories', 'protein', 'fiber', 'sodium']),
          value: z.number().finite().min(0).max(100_000),
          unit: z.string().trim().min(1).max(16),
        }),
      )
      .length(4),
  })
  .superRefine((value, context) => {
    const metrics = new Set(value.targets.map((target) => target.metric));
    if (metrics.size !== 4)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide one target for each supported metric.',
      });
  });
export const healthFocusesResponseSchema = z.object({
  focuses: z.array(healthFocusSchema).max(4),
});
export const updateHealthFocusesRequestSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    focuses: z.array(healthFocusSchema).max(4),
  })
  .superRefine((value, context) => {
    if (new Set(value.focuses).size !== value.focuses.length)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Each health focus can only be selected once.',
      });
  });
export const profileLocaleResponseSchema = z.object({
  locale: profileLocaleSchema,
});
export const onboardingGoalSchema = z.enum([
  'weight_loss',
  'maintain_weight',
  'muscle_gain',
  'fitness',
  'health_tracking',
]);
export const pregnancyContextSchema = z.enum([
  'not_applicable',
  'not_pregnant',
  'pregnant',
  'postpartum',
  'unsure',
  'prefer_not_to_say',
]);
export const medicationExerciseRiskSchema = z.enum([
  'glucose_lowering_without_plan',
  'dizziness_or_fainting_risk',
  'other_exercise_restriction',
]);
export const workoutInjuryFlagSchema = z.enum([
  'back_pain',
  'joint_pain',
  'balance_concern',
]);
export const workoutEquipmentSchema = z.enum([
  'bodyweight',
  'wall',
  'chair',
  'exercise_mat',
  'bicycle',
  'mini_treadmill',
  'resistance_band',
  'band_anchor',
  'dumbbells',
  'gym',
  'cable_machine',
]);
export const workoutEnvironmentSchema = z.enum(['home', 'outdoors', 'gym']);
export const clinicianRestrictionFlagSchema = z.enum([
  'avoid_high_intensity',
  'avoid_resistance',
  'avoid_impact',
  'monitor_glucose',
]);
export const onboardingDraftSchema = z
  .object({
    goal: onboardingGoalSchema.optional(),
    heightCm: z.number().int().min(80).max(250).optional(),
    weightKg: z.number().finite().positive().max(500).optional(),
    ageYears: z.number().int().min(1).max(120).optional(),
    sexForMetabolicCalculation: z
      .enum(['female', 'male', 'not_specified'])
      .optional(),
    pregnancyContext: pregnancyContextSchema.optional(),
    activityLevel: z
      .enum(['sedentary', 'light', 'moderate', 'active', 'very_active'])
      .optional(),
    foodPreferences: z
      .array(
        z.enum([
          'omnivore',
          'vegetarian',
          'vegan',
          'pescatarian',
          'halal',
          'low_sodium',
          'low_purine',
        ]),
      )
      .max(7)
      .optional(),
    allergies: z
      .array(
        z.enum([
          'milk',
          'egg',
          'fish',
          'shellfish',
          'peanut',
          'tree_nut',
          'soy',
          'wheat',
          'sesame',
        ]),
      )
      .max(9)
      .optional(),
    reportedContexts: z
      .array(
        z.enum(['blood_pressure', 'cholesterol', 'blood_glucose', 'uric_acid']),
      )
      .max(4)
      .optional(),
    injuryFlags: z.array(workoutInjuryFlagSchema).max(3).optional(),
    symptomFlags: z
      .array(
        z.enum([
          'none',
          'chest_discomfort',
          'dizziness',
          'shortness_of_breath',
        ]),
      )
      .max(4)
      .optional(),
    sleepHours: z.number().finite().min(0).max(24).optional(),
    trainingHistory: z
      .enum(['new_to_exercise', 'beginner', 'regular'])
      .optional(),
    availableDays: z
      .array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']))
      .min(1)
      .max(7)
      .optional(),
    equipment: z.array(workoutEquipmentSchema).min(1).max(11).optional(),
    environments: z.array(workoutEnvironmentSchema).min(1).max(3).optional(),
    clinicianRestrictionFlags: z
      .array(clinicianRestrictionFlagSchema)
      .max(4)
      .optional(),
    medicationExerciseRiskFlags: z
      .array(medicationExerciseRiskSchema)
      .max(3)
      .optional(),
  })
  .superRefine((value, context) => {
    for (const key of [
      'foodPreferences',
      'allergies',
      'reportedContexts',
      'injuryFlags',
      'symptomFlags',
      'availableDays',
      'equipment',
      'environments',
      'clinicianRestrictionFlags',
      'medicationExerciseRiskFlags',
    ] as const) {
      const items = value[key];
      if (items && new Set(items).size !== items.length)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: 'Each choice can only be selected once.',
        });
    }
    if (value.symptomFlags?.includes('none') && value.symptomFlags.length > 1)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['symptomFlags'],
        message: 'No symptoms cannot be selected with a symptom flag.',
      });
  });
export const updateOnboardingRequestSchema = z.object({
  idempotencyKey: z.string().uuid(),
  draft: onboardingDraftSchema,
});
export const onboardingResponseSchema = z.object({
  draft: onboardingDraftSchema,
  status: z.enum(['in_progress', 'complete']),
  updatedAt: z.string().datetime({ offset: true }).nullable(),
});
export const sensitiveNotesSchema = z.object({
  medicationNote: z.string().trim().max(2_000).default(''),
  clinicianNote: z.string().trim().max(2_000).default(''),
  symptomNote: z.string().trim().max(2_000).default(''),
});
export const updateSensitiveNotesRequestSchema = z.object({
  idempotencyKey: z.string().uuid(),
  notes: sensitiveNotesSchema,
});
export const sensitiveNotesResponseSchema = z.object({
  notes: sensitiveNotesSchema,
  updatedAt: z.string().datetime({ offset: true }).nullable(),
});
export const uploadKindSchema = z.enum([
  'meal_photo',
  'nutrition_label',
  'measurement_report',
]);
export const uploadResponseSchema = z.object({
  id: z.string().uuid(),
  kind: uploadKindSchema,
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  byteSize: z.number().int().positive().max(10_000_000),
  width: z.number().int().positive().max(8_000),
  height: z.number().int().positive().max(8_000),
  expiresAt: z.string().datetime({ offset: true }),
});
export const updateProfileLocaleRequestSchema = z.object({
  idempotencyKey: z.string().uuid(),
  locale: profileLocaleSchema,
});
export const measurementMetricSchema = z.enum([
  'weight',
  'blood_pressure',
  'blood_glucose',
  'total_cholesterol',
  'uric_acid',
  'custom_lab',
]);
export const measurementSourceSchema = z.enum(['manual', 'report_photo']);
export const measurementProvenanceSchema = z.enum([
  'user_entered',
  'user_confirmed_report',
  'user_confirmed_report_image_retained',
]);
export const measurementCreateRequestSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    metric: measurementMetricSchema,
    label: z.string().trim().min(1).max(80).optional(),
    value: z.number().finite().positive().max(100_000),
    secondaryValue: z.number().finite().positive().max(100_000).optional(),
    unit: z.string().trim().min(1).max(16),
    occurredAt: z.string().datetime({ offset: true }),
    source: measurementSourceSchema,
    sourceUploadId: z.string().uuid().optional(),
    retainSourceImage: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.metric !== 'custom_lab' &&
      !isSupportedMeasurementUnit(
        value.metric as ConvertibleMeasurementMetric,
        value.unit,
      )
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['unit'],
        message: `Use a supported unit for this measurement. It will be stored as ${canonicalMeasurementUnits[value.metric as ConvertibleMeasurementMetric]}.`,
      });
    if (value.metric === 'blood_pressure' && value.secondaryValue === undefined)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['secondaryValue'],
        message: 'Enter both systolic and diastolic blood pressure.',
      });
    if (value.metric !== 'blood_pressure' && value.secondaryValue !== undefined)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['secondaryValue'],
        message: 'Only blood pressure has a second value.',
      });
    if (value.metric === 'custom_lab' && value.label === undefined)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['label'],
        message: 'Name the custom lab result.',
      });
    if (value.metric !== 'custom_lab' && value.label !== undefined)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['label'],
        message: 'Only custom lab results can have a custom label.',
      });
    if (value.source === 'report_photo' && value.sourceUploadId === undefined)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceUploadId'],
        message:
          'A confirmed report image is required for report-derived values.',
      });
    if (
      value.source === 'manual' &&
      (value.sourceUploadId !== undefined || value.retainSourceImage)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['source'],
        message: 'Only report-derived values can retain a source image.',
      });
  });
export const measurementSchema = z.object({
  id: z.string().uuid(),
  metric: measurementMetricSchema,
  label: z.string().trim().min(1).max(80).nullable(),
  value: z.number().finite().positive(),
  secondaryValue: z.number().finite().positive().nullable(),
  unit: z.string().trim().min(1).max(16),
  occurredAt: z.string().datetime({ offset: true }),
  source: measurementSourceSchema,
  confirmationStatus: z.literal('confirmed'),
  provenance: measurementProvenanceSchema,
  sourceUploadId: z.string().uuid().nullable(),
  sourceImageRetained: z.boolean(),
});
export const measurementsResponseSchema = z.object({
  measurements: z.array(measurementSchema),
});
export const measurementExtractionItemSchema = z
  .object({
    metric: measurementMetricSchema,
    label: z.string().trim().min(1).max(80).nullable(),
    value: z.number().finite().positive().max(100_000).nullable(),
    secondaryValue: z.number().finite().positive().max(100_000).nullable(),
    unit: z.string().trim().min(1).max(16).nullable(),
    occurredAt: z.string().datetime({ offset: true }).nullable(),
    context: z.enum(['fasting', 'post_meal', 'unknown']),
    confidence: z.number().int().min(0).max(100),
  })
  .strict();
export const measurementExtractionProposalSchema = z
  .object({
    measurements: z.array(measurementExtractionItemSchema).min(1).max(20),
    unresolvedQuestions: z.array(z.string().trim().min(1).max(180)).max(6),
    manualReviewRequired: z.boolean(),
  })
  .strict();
export const extractMeasurementRequestSchema = z
  .object({ uploadId: z.string().uuid() })
  .strict();
export const measurementExtractionResponseSchema = z
  .object({
    proposal: measurementExtractionProposalSchema,
    model: z.string().trim().min(1).max(100),
    promptVersion: z.string().trim().min(1).max(40),
    schemaVersion: z.string().trim().min(1).max(40),
  })
  .strict();
export const workoutReadinessFlagSchema = z.enum(workoutReadinessFlagKeys);
export const workoutReadinessRequestSchema = z.object({
  idempotencyKey: z.string().uuid(),
  chestPain: z.boolean(),
  faintingOrDizziness: z.boolean(),
  severeShortnessOfBreath: z.boolean(),
  irregularHeartbeat: z.boolean(),
  clinicianRestriction: z.boolean(),
  exerciseGlucoseRisk: z.boolean(),
});
export const workoutReadinessResponseSchema = z.object({
  status: z.enum(['not_completed', 'cleared', 'needs_review']),
  flags: z.array(workoutReadinessFlagSchema),
  confirmedAt: z.string().datetime({ offset: true }).nullable(),
});
export const safetyDecisionDomainSchema = z.enum([
  'workout_plan',
  'workout_progression',
  'coach_exercise',
]);
export const safetyDecisionStatusSchema = z.enum([
  'allowed',
  'allowed_with_modifications',
  'blocked',
]);
export const safetyReasonCodeSchema = z.enum([
  'age_unconfirmed',
  'under_18',
  'pregnancy_review',
  'postpartum_review',
  'pregnancy_context_unsure',
  'medication_glucose_risk',
  'medication_dizziness_risk',
  'medication_other_restriction',
  'readiness_missing',
  'readiness_invalid',
  'readiness_stale',
  'readiness_chest_pain',
  'readiness_fainting_or_dizziness',
  'readiness_severe_shortness_of_breath',
  'readiness_irregular_heartbeat',
  'readiness_clinician_restriction',
  'readiness_exercise_glucose_risk',
  'reported_chest_discomfort',
  'reported_dizziness',
  'reported_shortness_of_breath',
  'clinician_avoid_high_intensity',
  'clinician_avoid_resistance',
  'clinician_avoid_impact',
  'clinician_monitor_glucose',
  'recent_workout_pain',
  'recent_workout_symptoms',
  'glucose_value_invalid',
  'pre_glucose_below_review_range',
  'pre_glucose_above_review_range',
  'post_glucose_recovery_review',
  'post_glucose_above_review_range',
]);
const safetyReasonSchema = z
  .object({
    code: safetyReasonCodeSchema,
    copyKey: z.string().regex(/^safetyContext\.reasons\.[a-z0-9_]+$/),
  })
  .refine(
    (reason) => reason.copyKey === `safetyContext.reasons.${reason.code}`,
    {
      path: ['copyKey'],
      message: 'Safety reason copy key must match its reason code.',
    },
  );
const safetyDecisionSchema = z.object({
  status: safetyDecisionStatusSchema,
  reasons: z.array(safetyReasonSchema).max(25),
});
const safetySourceSchema = z.object({
  kind: z.enum(['onboarding', 'readiness', 'workout_log']),
  recordId: z.string().min(1).max(100),
  recordedAt: z.string().datetime({ offset: true }),
});
const glucoseFactSchema = z.object({
  state: z.enum(['missing', 'reported', 'invalid']),
  policyStatus: z.enum([
    'missing',
    'invalid',
    'within_reviewed_range',
    'below_review_range',
    'above_review_range',
    'recovery_review',
  ]),
  valueMmolL: z.number().finite().positive().max(40).nullable(),
  sourceRecordId: z.string().min(1).max(100).nullable(),
  recordedAt: z.string().datetime({ offset: true }).nullable(),
});
export const effectiveSafetyContextSchema = z.object({
  contextVersion: z.literal('effective-safety-context-1'),
  evaluatedAt: z.string().datetime({ offset: true }),
  facts: z.object({
    eligibility: z.object({
      state: z.enum(['adult', 'under_18', 'unknown']),
      ageYears: z.number().int().min(1).max(120).nullable(),
    }),
    pregnancyContext: pregnancyContextSchema.nullable(),
    medicationExerciseRiskFlags: z.array(medicationExerciseRiskSchema).max(3),
    readiness: z.object({
      state: z.enum(['missing', 'invalid', 'stale', 'cleared', 'needs_review']),
      flags: z.array(workoutReadinessFlagSchema).max(6),
      confirmedAt: z.string().datetime({ offset: true }).nullable(),
    }),
    clinicianRestrictionFlags: z
      .array(
        z.enum([
          'avoid_high_intensity',
          'avoid_resistance',
          'avoid_impact',
          'monitor_glucose',
        ]),
      )
      .max(4),
    recentWorkoutSafety: z.object({
      pain: z.boolean(),
      concerningSymptoms: z.boolean(),
      sourceRecordIds: z.array(z.string().min(1).max(100)).max(20),
    }),
    glucose: z.object({
      policyVersion: z.literal('ada-exercise-glucose-2026-1'),
      evidenceSource: z.string().url(),
      pre: glucoseFactSchema,
      post: glucoseFactSchema,
    }),
  }),
  decisions: z.object({
    workout_plan: safetyDecisionSchema,
    workout_progression: safetyDecisionSchema,
    coach_exercise: safetyDecisionSchema,
  }),
  sources: z.array(safetySourceSchema).max(22),
});
const localizedTextSchema = z.object({
  en: z.string().trim().min(1).max(500),
  vi: z.string().trim().min(1).max(500),
});
const workoutPrescriptionSchema = z
  .object({
    exerciseId: z.string().trim().min(1).max(80),
    sets: z.number().int().min(1).max(10).optional(),
    reps: z.number().int().min(1).max(100).optional(),
    durationMinutes: z.number().int().min(1).max(180).optional(),
    restSeconds: z.number().int().min(0).max(300).optional(),
  })
  .superRefine((value, context) => {
    if (value.sets === undefined && value.durationMinutes === undefined)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Each prescription needs sets or a duration.',
      });
    if ((value.sets === undefined) !== (value.reps === undefined))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Strength prescriptions need both sets and reps.',
      });
  });
export const workoutPlanSchema = z.object({
  planVersion: z.literal('starter-plan-1'),
  periodStart: z.string().date(),
  sessions: z
    .array(
      z
        .object({
          id: z.string().trim().min(1).max(80),
          dayOffset: z.number().int().min(0).max(6),
          title: localizedTextSchema,
          durationMinutes: z.number().int().min(5).max(180),
          rpe: z.number().int().min(1).max(10),
          rationale: localizedTextSchema,
          exerciseIds: z.array(z.string().trim().min(1).max(80)).min(1).max(8),
          safetyNote: localizedTextSchema,
          warmup: localizedTextSchema.optional(),
          cooldown: localizedTextSchema.optional(),
          prescriptions: z
            .array(workoutPrescriptionSchema)
            .min(1)
            .max(8)
            .optional(),
          progressionCriteria: localizedTextSchema.optional(),
        })
        .superRefine((session, context) => {
          session.prescriptions?.forEach((prescription, index) => {
            if (!session.exerciseIds.includes(prescription.exerciseId))
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['prescriptions', index, 'exerciseId'],
                message: 'Each prescription must reference a session exercise.',
              });
          });
        }),
    )
    .min(1)
    .max(7),
});
export const workoutPlanResponseSchema = z.object({
  id: z.string().uuid().nullable(),
  status: z.enum(['preview', 'confirmed']),
  plan: workoutPlanSchema,
  confirmedAt: z.string().datetime({ offset: true }).nullable(),
});
export const confirmWorkoutPlanRequestSchema = z.object({
  idempotencyKey: z.string().uuid(),
  plan: workoutPlanSchema,
});
export const workoutLogRequestSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    planId: z.string().uuid(),
    sessionId: z.string().trim().min(1).max(80),
    durationMinutes: z.number().int().min(1).max(300),
    rpe: z.number().int().min(1).max(10),
    enjoyment: z.number().int().min(1).max(5).optional(),
    setsCompleted: z.number().int().min(1).max(100).optional(),
    repsPerSet: z.number().int().min(1).max(1_000).optional(),
    load: z.number().finite().positive().max(5_000).optional(),
    loadUnit: z.enum(['kg', 'lb']).optional(),
    averageHeartRate: z.number().int().min(20).max(260).optional(),
    pain: z.boolean(),
    concerningSymptoms: z.boolean(),
    preGlucose: z.number().finite().positive().max(40).optional(),
    postGlucose: z.number().finite().positive().max(40).optional(),
  })
  .superRefine((value, context) => {
    if ((value.pain || value.concerningSymptoms) && value.rpe > 5)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rpe'],
        message:
          'Use the actual effort, but do not continue a high-effort session with pain or concerning symptoms.',
      });
    if (
      (value.setsCompleted === undefined) !==
      (value.repsPerSet === undefined)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['setsCompleted'],
        message: 'Enter both sets and reps, or leave both blank.',
      });
    if (value.load !== undefined && value.loadUnit === undefined)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['loadUnit'],
        message: 'Choose kg or lb when recording load.',
      });
    if (value.load === undefined && value.loadUnit !== undefined)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['load'],
        message: 'Enter a load when choosing a load unit.',
      });
  });
export const workoutLogSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid(),
  sessionId: z.string().trim().min(1).max(80),
  status: z.enum(['completed', 'stopped_for_safety']),
  durationMinutes: z.number().int().min(1),
  rpe: z.number().int().min(1).max(10),
  enjoyment: z.number().int().min(1).max(5).nullable(),
  setsCompleted: z.number().int().min(1).nullable(),
  repsPerSet: z.number().int().min(1).nullable(),
  load: z.number().finite().positive().nullable(),
  loadUnit: z.enum(['kg', 'lb']).nullable(),
  averageHeartRate: z.number().int().min(20).max(260).nullable(),
  pain: z.boolean(),
  concerningSymptoms: z.boolean(),
  preGlucose: z.number().finite().positive().nullable(),
  postGlucose: z.number().finite().positive().nullable(),
  completedAt: z.string().datetime({ offset: true }),
  requiresReview: z.boolean(),
});
export const workoutLogsResponseSchema = z.object({
  logs: z.array(workoutLogSchema),
});
export const workoutCheckinRequestSchema = z.object({
  idempotencyKey: z.string().uuid(),
  planId: z.string().uuid(),
});
export const workoutCheckinSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid(),
  action: z.enum(['hold_for_review', 'repeat', 'maintain']),
  plannedSessions: z.number().int().min(1),
  completedSessions: z.number().int().min(0),
  safetyFlag: z.boolean(),
  safetyContextVersion: z.string().trim().min(1).max(80),
  safetyDecision: safetyDecisionStatusSchema,
  safetyReasonCodes: z.array(safetyReasonCodeSchema).max(25),
  createdAt: z.string().datetime({ offset: true }),
});
export const analyticsResponseSchema = z.object({
  periodDays: z.number().int().min(7).max(90),
  dailyNutrition: z.array(
    z.object({
      date: z.string().date(),
      calories: z.number().min(0),
      protein: z.number().min(0),
      fiber: z.number().min(0),
      sodium: z.number().min(0),
      mealCount: z.number().int().min(0),
    }),
  ),
  measurementTrends: z.array(
    z.object({
      metric: measurementMetricSchema,
      unit: z.string().trim().min(1).max(16),
      sampleSize: z.number().int().min(1),
      firstValue: z.number().finite().positive(),
      lastValue: z.number().finite().positive(),
      change: z.number().finite(),
    }),
  ),
  workout: z.object({
    completedSessions: z.number().int().min(0),
    stoppedForSafety: z.number().int().min(0),
    totalMinutes: z.number().int().min(0),
  }),
  completeness: z.object({
    observedDays: z.number().int().min(0).max(90),
    coveragePercent: z.number().int().min(0).max(100),
  }),
});
export const reminderKindSchema = z.enum([
  'meal',
  'workout',
  'measurement',
  'weekly_review',
]);
const reminderDaySchema = z.enum([
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
]);
const reminderTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const reminderScheduleSchema = z
  .object({
    timezone: z.literal('Asia/Bangkok'),
    time: reminderTimeSchema,
    days: z.array(reminderDaySchema).min(1).max(7),
    quietHours: z
      .object({ start: reminderTimeSchema, end: reminderTimeSchema })
      .strict()
      .optional(),
  })
  .superRefine((value, context) => {
    if (new Set(value.days).size !== value.days.length)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['days'],
        message: 'Each reminder day can only be selected once.',
      });
  });
export const reminderCreateRequestSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    kind: reminderKindSchema,
    schedule: reminderScheduleSchema,
  })
  .strict();
export const reminderActionRequestSchema = z.discriminatedUnion('action', [
  z
    .object({
      idempotencyKey: z.string().uuid(),
      action: z.enum(['pause', 'resume', 'delete']),
    })
    .strict(),
  z
    .object({
      idempotencyKey: z.string().uuid(),
      action: z.literal('snooze'),
      minutes: z.union([
        z.literal(15),
        z.literal(30),
        z.literal(60),
        z.literal(180),
      ]),
    })
    .strict(),
  z
    .object({
      idempotencyKey: z.string().uuid(),
      action: z.literal('reschedule'),
      schedule: reminderScheduleSchema,
    })
    .strict(),
]);
export const reminderSchema = z.object({
  id: z.string().uuid(),
  kind: reminderKindSchema,
  schedule: reminderScheduleSchema,
  nextDeliveryAt: z.string().datetime({ offset: true }),
  status: z.enum(['active', 'paused']),
});
export const remindersResponseSchema = z.object({
  reminders: z.array(reminderSchema).max(50),
});
export const accountDeletionRequestSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    confirmation: z.literal('DELETE MY DATA'),
  })
  .strict();
export type FoodAnalysis = z.infer<typeof foodAnalysisSchema>;
export type MealReviewDraft = z.infer<typeof mealReviewDraftSchema>;
export type ReviewedMealAnalysis = z.infer<typeof reviewedMealAnalysisSchema>;
export type FoodExtractionProposal = z.infer<
  typeof foodExtractionProposalSchema
>;
export type SavedFood = z.infer<typeof savedFoodSchema>;
export type SavePersonalFoodRequest = z.infer<
  typeof savePersonalFoodRequestSchema
>;
export type HealthFinding = z.infer<typeof healthFindingSchema>;
export type HealthFocus = z.infer<typeof healthFocusSchema>;
export type MealCreateRequest = z.infer<typeof createMealRequestSchema>;
export type OnboardingDraft = z.infer<typeof onboardingDraftSchema>;
export type ClinicianRestrictionFlag = z.infer<
  typeof clinicianRestrictionFlagSchema
>;
export type SensitiveNotes = z.infer<typeof sensitiveNotesSchema>;
export type UploadRecord = z.infer<typeof uploadResponseSchema>;
export type ProfileTargetsUpdateRequest = z.infer<
  typeof updateProfileTargetsRequestSchema
>;
export type Measurement = z.infer<typeof measurementSchema>;
export type MeasurementExtractionProposal = z.infer<
  typeof measurementExtractionProposalSchema
>;
export type MeasurementCreateRequest = z.infer<
  typeof measurementCreateRequestSchema
>;
export type WorkoutReadiness = z.infer<typeof workoutReadinessResponseSchema>;
export type WorkoutReadinessRequest = z.infer<
  typeof workoutReadinessRequestSchema
>;
export type EffectiveSafetyContext = z.infer<
  typeof effectiveSafetyContextSchema
>;
export type SafetyDecisionDomain = z.infer<typeof safetyDecisionDomainSchema>;
export type SafetyReasonCode = z.infer<typeof safetyReasonCodeSchema>;
export type WorkoutPlan = z.infer<typeof workoutPlanSchema>;
export type WorkoutPlanResponse = z.infer<typeof workoutPlanResponseSchema>;
export type WorkoutLog = z.infer<typeof workoutLogSchema>;
export type WorkoutLogRequest = z.infer<typeof workoutLogRequestSchema>;
export type WorkoutCheckin = z.infer<typeof workoutCheckinSchema>;
export type Analytics = z.infer<typeof analyticsResponseSchema>;
export type Reminder = z.infer<typeof reminderSchema>;
