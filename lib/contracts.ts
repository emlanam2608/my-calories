import { z } from 'zod';
import { canonicalMeasurementUnits, isSupportedMeasurementUnit, type ConvertibleMeasurementMetric } from './measurement-conversions';
import { workoutReadinessFlagKeys } from './workout-readiness';

export const nutrientTotalsSchema = z.object({
  calories: z.number().finite().min(0).max(10_000),
  protein: z.number().finite().min(0).max(1_000),
  fiber: z.number().finite().min(0).max(1_000),
  sodium: z.number().finite().min(0).max(100_000),
});
export const healthFindingSchema = z.object({
  condition: z.enum([
    'weight_management',
    'blood_pressure',
    'cholesterol',
    'blood_glucose',
    'uric_acid',
  ]),
  severity: z.enum(['info', 'attention']),
  ruleCode: z.string().trim().min(1).max(80),
  ruleVersion: z.string().trim().min(1).max(40),
  observedValue: z.number().finite().min(0),
  observedUnit: z.string().trim().min(1).max(16),
  targetValue: z.number().finite().min(0).nullable(),
  targetUnit: z.string().trim().min(1).max(16),
  evidenceSource: z.string().trim().min(1).max(160),
  text: z.string().trim().min(1).max(500),
  suggestedActions: z.array(z.string().trim().min(1).max(180)).min(1).max(3),
});
export const healthFocusSchema = z.enum([
  'blood_pressure',
  'cholesterol',
  'blood_glucose',
  'uric_acid',
]);
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
});
export const mealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
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
  healthFindings: z.array(healthFindingSchema).max(6).optional(),
});
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
export const createMealRequestSchema = z.object({
  idempotencyKey: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  mealType: mealTypeSchema,
  occurredAt: z.string().datetime({ offset: true }),
  confidence: z.number().int().min(0).max(100),
  analysisSource: z.enum([
    'manual_estimate',
    'manual_entry',
    'open_food_facts',
    'vietnam_institute_nutrition',
    'usda_fooddata_central',
  ]),
  nutritionSnapshot: nutritionSnapshotSchema,
});
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
export const onboardingGoalSchema = z.enum(['weight_loss', 'maintain_weight', 'muscle_gain', 'fitness', 'health_tracking']);
export const onboardingDraftSchema = z.object({
  goal: onboardingGoalSchema.optional(),
  heightCm: z.number().int().min(80).max(250).optional(),
  weightKg: z.number().finite().positive().max(500).optional(),
  ageYears: z.number().int().min(18).max(120).optional(),
  sexForMetabolicCalculation: z.enum(['female', 'male', 'not_specified']).optional(),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']).optional(),
  foodPreferences: z.array(z.enum(['omnivore', 'vegetarian', 'vegan', 'pescatarian', 'halal', 'low_sodium', 'low_purine'])).max(7).optional(),
  allergies: z.array(z.enum(['milk', 'egg', 'fish', 'shellfish', 'peanut', 'tree_nut', 'soy', 'wheat', 'sesame'])).max(9).optional(),
  reportedContexts: z.array(z.enum(['blood_pressure', 'cholesterol', 'blood_glucose', 'uric_acid'])).max(4).optional(),
  injuryFlags: z.array(z.enum(['back_pain', 'joint_pain', 'balance_concern'])).max(3).optional(),
  symptomFlags: z.array(z.enum(['none', 'chest_discomfort', 'dizziness', 'shortness_of_breath'])).max(4).optional(),
  sleepHours: z.number().finite().min(0).max(24).optional(),
  trainingHistory: z.enum(['new_to_exercise', 'beginner', 'regular']).optional(),
  availableDays: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).min(1).max(7).optional(),
  equipment: z.array(z.enum(['bodyweight', 'chair', 'exercise_mat', 'bicycle', 'mini_treadmill', 'resistance_band', 'dumbbells', 'gym'])).min(1).max(8).optional(),
  environments: z.array(z.enum(['home', 'outdoors', 'gym'])).min(1).max(3).optional(),
  clinicianRestrictionFlags: z.array(z.enum(['avoid_high_intensity', 'avoid_resistance', 'avoid_impact', 'monitor_glucose'])).max(4).optional(),
}).superRefine((value, context) => {
  for (const key of ['foodPreferences', 'allergies', 'reportedContexts', 'injuryFlags', 'symptomFlags', 'availableDays', 'equipment', 'environments', 'clinicianRestrictionFlags'] as const) {
    const items = value[key];
    if (items && new Set(items).size !== items.length) context.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: 'Each choice can only be selected once.' });
  }
  if (
    value.symptomFlags?.includes('none') &&
    value.symptomFlags.length > 1
  )
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['symptomFlags'],
      message: 'No symptoms cannot be selected with a symptom flag.',
    });
});
export const updateOnboardingRequestSchema = z.object({ idempotencyKey: z.string().uuid(), draft: onboardingDraftSchema });
export const onboardingResponseSchema = z.object({ draft: onboardingDraftSchema, status: z.enum(['in_progress', 'complete']), updatedAt: z.string().datetime({ offset: true }).nullable() });
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
export const measurementSourceSchema = z.literal('manual');
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
  })
  .superRefine((value, context) => {
    if (
      value.metric !== 'custom_lab' &&
      !isSupportedMeasurementUnit(value.metric as ConvertibleMeasurementMetric, value.unit)
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
  provenance: z.literal('user_entered'),
});
export const measurementsResponseSchema = z.object({
  measurements: z.array(measurementSchema),
});
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
const localizedTextSchema = z.object({
  en: z.string().trim().min(1).max(500),
  vi: z.string().trim().min(1).max(500),
});
export const workoutPlanSchema = z.object({
  planVersion: z.literal('starter-plan-1'),
  periodStart: z.string().date(),
  sessions: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        dayOffset: z.number().int().min(0).max(6),
        title: localizedTextSchema,
        durationMinutes: z.number().int().min(5).max(180),
        rpe: z.number().int().min(1).max(10),
        rationale: localizedTextSchema,
        exerciseIds: z.array(z.string().trim().min(1).max(80)).min(1).max(8),
        safetyNote: localizedTextSchema,
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
        message: 'Use the actual effort, but do not continue a high-effort session with pain or concerning symptoms.',
      });
    if ((value.setsCompleted === undefined) !== (value.repsPerSet === undefined))
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
export const workoutLogsResponseSchema = z.object({ logs: z.array(workoutLogSchema) });
export const workoutCheckinRequestSchema = z.object({ idempotencyKey: z.string().uuid(), planId: z.string().uuid() });
export const workoutCheckinSchema = z.object({ id: z.string().uuid(), planId: z.string().uuid(), action: z.enum(['hold_for_review', 'repeat', 'maintain']), plannedSessions: z.number().int().min(1), completedSessions: z.number().int().min(0), safetyFlag: z.boolean(), createdAt: z.string().datetime({ offset: true }) });
export type FoodAnalysis = z.infer<typeof foodAnalysisSchema>;
export type HealthFinding = z.infer<typeof healthFindingSchema>;
export type HealthFocus = z.infer<typeof healthFocusSchema>;
export type MealCreateRequest = z.infer<typeof createMealRequestSchema>;
export type OnboardingDraft = z.infer<typeof onboardingDraftSchema>;
export type SensitiveNotes = z.infer<typeof sensitiveNotesSchema>;
export type ProfileTargetsUpdateRequest = z.infer<
  typeof updateProfileTargetsRequestSchema
>;
export type Measurement = z.infer<typeof measurementSchema>;
export type MeasurementCreateRequest = z.infer<
  typeof measurementCreateRequestSchema
>;
export type WorkoutReadiness = z.infer<typeof workoutReadinessResponseSchema>;
export type WorkoutReadinessRequest = z.infer<typeof workoutReadinessRequestSchema>;
export type WorkoutPlan = z.infer<typeof workoutPlanSchema>;
export type WorkoutPlanResponse = z.infer<typeof workoutPlanResponseSchema>;
export type WorkoutLog = z.infer<typeof workoutLogSchema>;
export type WorkoutLogRequest = z.infer<typeof workoutLogRequestSchema>;
export type WorkoutCheckin = z.infer<typeof workoutCheckinSchema>;
