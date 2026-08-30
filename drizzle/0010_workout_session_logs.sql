ALTER TABLE `workout_sessions` ADD `plan_id` text;
--> statement-breakpoint
ALTER TABLE `workout_sessions` ADD `session_id` text;
--> statement-breakpoint
ALTER TABLE `workout_sessions` ADD `enjoyment` integer;
--> statement-breakpoint
ALTER TABLE `workout_sessions` ADD `pain` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `workout_sessions` ADD `concerning_symptoms` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `workout_sessions` ADD `pre_glucose_scaled` integer;
--> statement-breakpoint
ALTER TABLE `workout_sessions` ADD `post_glucose_scaled` integer;
--> statement-breakpoint
ALTER TABLE `workout_sessions` ADD `glucose_scale` integer NOT NULL DEFAULT 10;
--> statement-breakpoint
CREATE INDEX `idx_workouts_owner_plan_session` ON `workout_sessions` (`owner_id`,`plan_id`,`session_id`);
