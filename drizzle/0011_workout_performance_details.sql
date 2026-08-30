ALTER TABLE `workout_sessions` ADD `sets_completed` integer;
--> statement-breakpoint
ALTER TABLE `workout_sessions` ADD `reps_per_set` integer;
--> statement-breakpoint
ALTER TABLE `workout_sessions` ADD `load_scaled` integer;
--> statement-breakpoint
ALTER TABLE `workout_sessions` ADD `load_scale` integer NOT NULL DEFAULT 10;
--> statement-breakpoint
ALTER TABLE `workout_sessions` ADD `load_unit` text;
--> statement-breakpoint
ALTER TABLE `workout_sessions` ADD `average_heart_rate` integer;
