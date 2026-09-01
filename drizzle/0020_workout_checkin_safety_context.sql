ALTER TABLE `workout_checkins` ADD `safety_context_version` text DEFAULT 'legacy' NOT NULL;
--> statement-breakpoint
ALTER TABLE `workout_checkins` ADD `safety_decision` text DEFAULT 'allowed' NOT NULL;
--> statement-breakpoint
ALTER TABLE `workout_checkins` ADD `safety_reason_codes` text DEFAULT '[]' NOT NULL;
