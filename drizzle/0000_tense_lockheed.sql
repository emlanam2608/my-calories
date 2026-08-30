CREATE TABLE `health_targets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`metric` text NOT NULL,
	`value` text NOT NULL,
	`unit` text NOT NULL,
	`authority` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_health_targets_owner_metric` ON `health_targets` (`owner_id`,`metric`);--> statement-breakpoint
CREATE TABLE `meal_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`meal_type` text NOT NULL,
	`name` text NOT NULL,
	`nutrition_snapshot` text NOT NULL,
	`analysis_source` text NOT NULL,
	`confidence` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_meal_entries_owner_occurred` ON `meal_entries` (`owner_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`metric` text NOT NULL,
	`value` text NOT NULL,
	`unit` text NOT NULL,
	`context` text,
	`source` text NOT NULL,
	`occurred_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_measurements_owner_metric_date` ON `measurements` (`owner_id`,`metric`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`display_name` text,
	`locale` text DEFAULT 'vi' NOT NULL,
	`timezone` text DEFAULT 'Asia/Bangkok' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_owner_id_unique` ON `profiles` (`owner_id`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`kind` text NOT NULL,
	`schedule` text NOT NULL,
	`next_delivery_at` integer NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_reminders_due` ON `reminders` (`status`,`next_delivery_at`);--> statement-breakpoint
CREATE TABLE `workout_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`plan_version` text NOT NULL,
	`status` text NOT NULL,
	`duration_minutes` integer,
	`rpe` integer,
	`safety_notes` text,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_workouts_owner_completed` ON `workout_sessions` (`owner_id`,`completed_at`);
