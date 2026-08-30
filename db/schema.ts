import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().unique(),
  displayName: text('display_name'),
  locale: text('locale').notNull().default('vi'),
  timezone: text('timezone').notNull().default('Asia/Bangkok'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});
export const healthTargets = sqliteTable(
  'health_targets',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    metric: text('metric').notNull(),
    valueScaled: integer('value_scaled').notNull(),
    valueScale: integer('value_scale').notNull(),
    unit: text('unit').notNull(),
    authority: text('authority').notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('idx_health_targets_owner_metric').on(table.ownerId, table.metric),
  ],
);
export const healthFocuses = sqliteTable(
  'health_focuses',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    focus: text('focus').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('idx_health_focuses_owner_focus').on(
      table.ownerId,
      table.focus,
    ),
  ],
);
export const mealEntries = sqliteTable(
  'meal_entries',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
    mealType: text('meal_type').notNull(),
    name: text('name').notNull(),
    nutritionSnapshot: text('nutrition_snapshot', { mode: 'json' }).notNull(),
    analysisSource: text('analysis_source').notNull(),
    confidence: integer('confidence').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('idx_meal_entries_owner_occurred').on(
      table.ownerId,
      table.occurredAt,
    ),
  ],
);
export const measurements = sqliteTable(
  'measurements',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    metric: text('metric').notNull(),
    label: text('label'),
    valueScaled: integer('value_scaled').notNull(),
    secondaryValueScaled: integer('secondary_value_scaled'),
    valueScale: integer('value_scale').notNull(),
    unit: text('unit').notNull(),
    source: text('source').notNull(),
    confirmationStatus: text('confirmation_status').notNull(),
    provenance: text('provenance').notNull(),
    occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('idx_measurements_owner_metric_date').on(
      table.ownerId,
      table.metric,
      table.occurredAt,
    ),
  ],
);
export const workoutSessions = sqliteTable(
  'workout_sessions',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    planVersion: text('plan_version').notNull(),
    status: text('status').notNull(),
    durationMinutes: integer('duration_minutes'),
    rpe: integer('rpe'),
    safetyNotes: text('safety_notes'),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('idx_workouts_owner_completed').on(table.ownerId, table.completedAt),
  ],
);
export const workoutReadiness = sqliteTable(
  'workout_readiness',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    chestPain: integer('chest_pain', { mode: 'boolean' }).notNull(),
    faintingOrDizziness: integer('fainting_or_dizziness', {
      mode: 'boolean',
    }).notNull(),
    severeShortnessOfBreath: integer('severe_shortness_of_breath', {
      mode: 'boolean',
    }).notNull(),
    irregularHeartbeat: integer('irregular_heartbeat', {
      mode: 'boolean',
    }).notNull(),
    clinicianRestriction: integer('clinician_restriction', {
      mode: 'boolean',
    }).notNull(),
    exerciseGlucoseRisk: integer('exercise_glucose_risk', {
      mode: 'boolean',
    }).notNull(),
    status: text('status').notNull(),
    confirmedAt: integer('confirmed_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('idx_workout_readiness_owner').on(table.ownerId),
  ],
);
export const exerciseCatalog = sqliteTable(
  'exercise_catalog',
  {
    id: text('id').primaryKey(),
    name: text('name', { mode: 'json' }).notNull(),
    category: text('category').notNull(),
    equipment: text('equipment', { mode: 'json' }).notNull(),
    muscleGroups: text('muscle_groups', { mode: 'json' }).notNull(),
    contraindicationTags: text('contraindication_tags', { mode: 'json' })
      .notNull(),
    technique: text('technique', { mode: 'json' }).notNull(),
    regression: text('regression', { mode: 'json' }).notNull(),
    progression: text('progression', { mode: 'json' }).notNull(),
    substitutionIds: text('substitution_ids', { mode: 'json' }).notNull(),
    catalogVersion: text('catalog_version').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('idx_exercise_catalog_category').on(table.category)],
);
export const workoutPlans = sqliteTable(
  'workout_plans',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    planVersion: text('plan_version').notNull(),
    periodStart: text('period_start').notNull(),
    status: text('status').notNull(),
    plan: text('plan', { mode: 'json' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    confirmedAt: integer('confirmed_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('idx_workout_plans_owner_created').on(table.ownerId, table.createdAt),
  ],
);
export const reminders = sqliteTable(
  'reminders',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    kind: text('kind').notNull(),
    schedule: text('schedule', { mode: 'json' }).notNull(),
    nextDeliveryAt: integer('next_delivery_at', {
      mode: 'timestamp_ms',
    }).notNull(),
    status: text('status').notNull(),
  },
  (table) => [
    index('idx_reminders_due').on(table.status, table.nextDeliveryAt),
  ],
);
export const requestDeduplications = sqliteTable(
  'request_deduplications',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('idx_request_dedup_owner_key').on(
      table.ownerId,
      table.idempotencyKey,
    ),
  ],
);
export const foodLookupCache = sqliteTable(
  'food_lookup_cache',
  {
    cacheKey: text('cache_key').primaryKey(),
    provider: text('provider').notNull(),
    analysis: text('analysis', { mode: 'json' }).notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('idx_food_lookup_cache_expiry').on(table.expiresAt)],
);
