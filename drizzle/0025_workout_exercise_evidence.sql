ALTER TABLE `workout_sessions` ADD `evidence_version` text DEFAULT 'legacy-aggregate-1' NOT NULL;
--> statement-breakpoint
ALTER TABLE `workout_sessions` ADD `data_completeness` text DEFAULT 'legacy_aggregate' NOT NULL;
--> statement-breakpoint
ALTER TABLE `workout_sessions` ADD `adherence_status` text DEFAULT 'legacy_unknown' NOT NULL;
--> statement-breakpoint
CREATE TABLE `workout_exercise_results` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`workout_session_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`session_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`status` text NOT NULL,
	`actual_sets` integer,
	`actual_reps` integer,
	`actual_duration_minutes` integer,
	`actual_load_scaled` integer,
	`actual_load_scale` integer DEFAULT 10 NOT NULL,
	`load_unit` text,
	`substitution_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_workout_results_session_exercise` ON `workout_exercise_results` (`workout_session_id`,`exercise_id`);
--> statement-breakpoint
CREATE INDEX `idx_workout_results_owner_session` ON `workout_exercise_results` (`owner_id`,`workout_session_id`);
--> statement-breakpoint
CREATE INDEX `idx_workout_results_owner_plan_session` ON `workout_exercise_results` (`owner_id`,`plan_id`,`session_id`);
--> statement-breakpoint
ALTER TABLE `workout_checkins` ADD `recovery_status` text DEFAULT 'not_recorded' NOT NULL;
--> statement-breakpoint
ALTER TABLE `workout_checkins` ADD `soreness_flag` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `workout_checkins` ADD `pain_flag` integer DEFAULT false NOT NULL;
