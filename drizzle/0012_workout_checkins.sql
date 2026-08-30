CREATE TABLE `workout_checkins` (`id` text PRIMARY KEY NOT NULL, `owner_id` text NOT NULL, `plan_id` text NOT NULL, `action` text NOT NULL, `planned_sessions` integer NOT NULL, `completed_sessions` integer NOT NULL, `safety_flag` integer NOT NULL, `created_at` integer NOT NULL);
--> statement-breakpoint
CREATE INDEX `idx_workout_checkins_owner_plan` ON `workout_checkins` (`owner_id`,`plan_id`,`created_at`);
