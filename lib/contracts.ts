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
export type FoodAnalysis = z.infer<typeof foodAnalysisSchema>;
export type HealthFinding = z.infer<typeof healthFindingSchema>;
export type HealthFocus = z.infer<typeof healthFocusSchema>;
export type MealCreateRequest = z.infer<typeof createMealRequestSchema>;
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
