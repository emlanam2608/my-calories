import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const authIdentities = sqliteTable(
  'auth_identities',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    provider: text('provider').notNull(),
    issuer: text('issuer').notNull(),
    subject: text('subject').notNull(),
    emailAtLink: text('email_at_link').notNull(),
    linkedAt: integer('linked_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    check(
      'auth_identities_provider_check',
      sql`${table.provider} = 'cloudflare_access'`,
    ),
    uniqueIndex('idx_auth_identities_provider_issuer_subject').on(
      table.provider,
      table.issuer,
      table.subject,
    ),
    index('idx_auth_identities_owner').on(table.ownerId),
  ],
);
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
export const profileOnboarding = sqliteTable(
  'profile_onboarding',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    draft: text('draft', { mode: 'json' }).notNull(),
    status: text('status').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [uniqueIndex('idx_profile_onboarding_owner').on(table.ownerId)],
);
export const profileSensitiveNotes = sqliteTable(
  'profile_sensitive_notes',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    ciphertext: text('ciphertext', { mode: 'json' }).notNull(),
    keyVersion: text('key_version').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('idx_profile_sensitive_notes_owner').on(table.ownerId),
  ],
);
export const uploads = sqliteTable(
  'uploads',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    storageKey: text('storage_key').notNull(),
    kind: text('kind').notNull(),
    contentType: text('content_type').notNull(),
    byteSize: integer('byte_size').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    status: text('status').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('idx_uploads_owner_status').on(table.ownerId, table.status),
    index('idx_uploads_expiry').on(table.status, table.expiresAt),
  ],
);
export const aiExecutions = sqliteTable(
  'ai_executions',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    uploadId: text('upload_id'),
    feature: text('feature').notNull(),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    schemaVersion: text('schema_version').notNull(),
    status: text('status').notNull(),
    latencyMs: integer('latency_ms').notNull(),
    failureCode: text('failure_code'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('idx_ai_executions_owner_created').on(table.ownerId, table.createdAt),
    index('idx_ai_executions_upload').on(table.uploadId, table.createdAt),
  ],
);
export const savedFoods = sqliteTable(
  'saved_foods',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    kind: text('kind').notNull(),
    name: text('name').notNull(),
    nameVi: text('name_vi').notNull(),
    normalizedName: text('normalized_name').notNull(),
    nutritionSnapshot: text('nutrition_snapshot', { mode: 'json' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('idx_saved_foods_owner_normalized').on(
      table.ownerId,
      table.normalizedName,
    ),
    index('idx_saved_foods_owner_updated').on(table.ownerId, table.updatedAt),
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
export const mealAnalysisReviews = sqliteTable(
  'meal_analysis_reviews',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    analysis: text('analysis', { mode: 'json' }).notNull(),
    contextFingerprint: text('context_fingerprint').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    consumedAt: integer('consumed_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('idx_meal_analysis_reviews_owner_expires').on(
      table.ownerId,
      table.expiresAt,
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
    healthFindings: text('health_findings', { mode: 'json' })
      .notNull()
      .default([]),
    analysisSource: text('analysis_source').notNull(),
    confidence: integer('confidence').notNull(),
    reviewId: text('review_id'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('idx_meal_entries_owner_occurred').on(
      table.ownerId,
      table.occurredAt,
    ),
    uniqueIndex('idx_meal_entries_review_id').on(table.reviewId),
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
    sourceUploadId: text('source_upload_id'),
    occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('idx_measurements_owner_metric_date').on(
      table.ownerId,
      table.metric,
      table.occurredAt,
    ),
    index('idx_measurements_owner_source_upload').on(
      table.ownerId,
      table.sourceUploadId,
    ),
  ],
);
export const workoutSessions = sqliteTable(
  'workout_sessions',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    planId: text('plan_id'),
    sessionId: text('session_id'),
    planVersion: text('plan_version').notNull(),
    status: text('status').notNull(),
    durationMinutes: integer('duration_minutes'),
    rpe: integer('rpe'),
    enjoyment: integer('enjoyment'),
    setsCompleted: integer('sets_completed'),
    repsPerSet: integer('reps_per_set'),
    loadScaled: integer('load_scaled'),
    loadScale: integer('load_scale').notNull().default(10),
    loadUnit: text('load_unit'),
    averageHeartRate: integer('average_heart_rate'),
    pain: integer('pain', { mode: 'boolean' }).notNull().default(false),
    concerningSymptoms: integer('concerning_symptoms', { mode: 'boolean' })
      .notNull()
      .default(false),
    preGlucoseScaled: integer('pre_glucose_scaled'),
    postGlucoseScaled: integer('post_glucose_scaled'),
    glucoseScale: integer('glucose_scale').notNull().default(10),
    safetyNotes: text('safety_notes'),
    evidenceVersion: text('evidence_version')
      .notNull()
      .default('legacy-aggregate-1'),
    dataCompleteness: text('data_completeness')
      .notNull()
      .default('legacy_aggregate'),
    adherenceStatus: text('adherence_status')
      .notNull()
      .default('legacy_unknown'),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('idx_workouts_owner_completed').on(table.ownerId, table.completedAt),
    index('idx_workouts_owner_plan_session').on(
      table.ownerId,
      table.planId,
      table.sessionId,
    ),
  ],
);
export const workoutExerciseResults = sqliteTable(
  'workout_exercise_results',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    workoutSessionId: text('workout_session_id').notNull(),
    planId: text('plan_id').notNull(),
    sessionId: text('session_id').notNull(),
    exerciseId: text('exercise_id').notNull(),
    status: text('status').notNull(),
    actualSets: integer('actual_sets'),
    actualReps: integer('actual_reps'),
    actualDurationMinutes: integer('actual_duration_minutes'),
    actualLoadScaled: integer('actual_load_scaled'),
    actualLoadScale: integer('actual_load_scale').notNull().default(10),
    loadUnit: text('load_unit'),
    substitutionId: text('substitution_id'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('idx_workout_results_session_exercise').on(
      table.workoutSessionId,
      table.exerciseId,
    ),
    index('idx_workout_results_owner_session').on(
      table.ownerId,
      table.workoutSessionId,
    ),
    index('idx_workout_results_owner_plan_session').on(
      table.ownerId,
      table.planId,
      table.sessionId,
    ),
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
  (table) => [uniqueIndex('idx_workout_readiness_owner').on(table.ownerId)],
);
export const exerciseCatalog = sqliteTable(
  'exercise_catalog',
  {
    id: text('id').primaryKey(),
    name: text('name', { mode: 'json' }).notNull(),
    category: text('category').notNull(),
    equipment: text('equipment', { mode: 'json' }).notNull(),
    environments: text('environments', { mode: 'json' })
      .notNull()
      .default(['home', 'gym']),
    muscleGroups: text('muscle_groups', { mode: 'json' }).notNull(),
    contraindicationTags: text('contraindication_tags', {
      mode: 'json',
    }).notNull(),
    technique: text('technique', { mode: 'json' }).notNull(),
    regression: text('regression', { mode: 'json' }).notNull(),
    progression: text('progression', { mode: 'json' }).notNull(),
    substitutionIds: text('substitution_ids', { mode: 'json' }).notNull(),
    catalogVersion: text('catalog_version').notNull(),
    reviewStatus: text('review_status').notNull().default('unreviewed'),
    reviewedVersion: text('reviewed_version'),
    reviewedAt: text('reviewed_at'),
    reviewReference: text('review_reference'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('idx_exercise_catalog_category').on(table.category),
    index('idx_exercise_catalog_version_category').on(
      table.catalogVersion,
      table.category,
    ),
  ],
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
    planningContext: text('planning_context', { mode: 'json' }),
    planningContextDigest: text('planning_context_digest'),
    catalogVersion: text('catalog_version'),
    sourcePreviewId: text('source_preview_id'),
    sourceProposalId: text('source_proposal_id'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    confirmedAt: integer('confirmed_at', { mode: 'timestamp_ms' }).notNull(),
    supersededAt: integer('superseded_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('idx_workout_plans_owner_created').on(table.ownerId, table.createdAt),
    index('idx_workout_plans_owner_status_created').on(
      table.ownerId,
      table.status,
      table.createdAt,
    ),
    uniqueIndex('idx_workout_plans_source_preview').on(table.sourcePreviewId),
    uniqueIndex('idx_workout_plans_source_proposal').on(table.sourceProposalId),
    uniqueIndex('idx_workout_plans_one_active')
      .on(table.ownerId)
      .where(sql`${table.status} = 'active'`),
  ],
);
export const workoutPlanPreviews = sqliteTable(
  'workout_plan_previews',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    status: text('status').notNull(),
    planningContext: text('planning_context', { mode: 'json' }).notNull(),
    planningContextDigest: text('planning_context_digest').notNull(),
    catalogVersion: text('catalog_version').notNull(),
    plan: text('plan', { mode: 'json' }).notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    activatedPlanId: text('activated_plan_id'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    activatedAt: integer('activated_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('idx_workout_plan_previews_owner_status_expires').on(
      table.ownerId,
      table.status,
      table.expiresAt,
    ),
  ],
);
export const workoutCheckins = sqliteTable(
  'workout_checkins',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    planId: text('plan_id').notNull(),
    action: text('action').notNull(),
    plannedSessions: integer('planned_sessions').notNull(),
    completedSessions: integer('completed_sessions').notNull(),
    safetyFlag: integer('safety_flag', { mode: 'boolean' }).notNull(),
    safetyContextVersion: text('safety_context_version')
      .notNull()
      .default('legacy'),
    safetyDecision: text('safety_decision').notNull().default('allowed'),
    safetyReasonCodes: text('safety_reason_codes', { mode: 'json' })
      .notNull()
      .default([]),
    recoveryStatus: text('recovery_status').notNull().default('not_recorded'),
    sorenessFlag: integer('soreness_flag', { mode: 'boolean' })
      .notNull()
      .default(false),
    painFlag: integer('pain_flag', { mode: 'boolean' })
      .notNull()
      .default(false),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('idx_workout_checkins_owner_plan').on(
      table.ownerId,
      table.planId,
      table.createdAt,
    ),
  ],
);
export const workoutAdaptationProposals = sqliteTable(
  'workout_adaptation_proposals',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    proposalVersion: text('proposal_version').notNull(),
    status: text('status').notNull(),
    action: text('action').notNull(),
    basePlanId: text('base_plan_id').notNull(),
    basePlanVersion: text('base_plan_version').notNull(),
    policyVersion: text('policy_version').notNull(),
    policyReviewStatus: text('policy_review_status').notNull(),
    catalogVersion: text('catalog_version').notNull(),
    safetyContextVersion: text('safety_context_version').notNull(),
    inputDigest: text('input_digest').notNull(),
    evidenceRecordIds: text('evidence_record_ids', { mode: 'json' }).notNull(),
    dataCompleteness: text('data_completeness').notNull(),
    confidence: text('confidence').notNull(),
    reasonCodes: text('reason_codes', { mode: 'json' }).notNull(),
    changes: text('changes', { mode: 'json' }).notNull(),
    unresolvedQuestions: text('unresolved_questions', {
      mode: 'json',
    }).notNull(),
    proposedPlan: text('proposed_plan', { mode: 'json' }),
    sourceCheckinId: text('source_checkin_id').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    confirmedPlanId: text('confirmed_plan_id'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    confirmedAt: integer('confirmed_at', { mode: 'timestamp_ms' }),
    dismissedAt: integer('dismissed_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    uniqueIndex('idx_workout_proposals_source_checkin').on(
      table.sourceCheckinId,
    ),
    index('idx_workout_proposals_owner_base_created').on(
      table.ownerId,
      table.basePlanId,
      table.createdAt,
    ),
    index('idx_workout_proposals_owner_status_expires').on(
      table.ownerId,
      table.status,
      table.expiresAt,
    ),
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
