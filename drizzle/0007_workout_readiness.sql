CREATE TABLE `workout_readiness` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `chest_pain` integer NOT NULL,
  `fainting_or_dizziness` integer NOT NULL,
  `severe_shortness_of_breath` integer NOT NULL,
  `irregular_heartbeat` integer NOT NULL,
  `clinician_restriction` integer NOT NULL,
  `exercise_glucose_risk` integer NOT NULL,
  `status` text NOT NULL,
  `confirmed_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_workout_readiness_owner` ON `workout_readiness` (`owner_id`);
