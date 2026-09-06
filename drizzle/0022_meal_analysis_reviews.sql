CREATE TABLE `meal_analysis_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`analysis` text NOT NULL,
	`context_fingerprint` text NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_meal_analysis_reviews_owner_expires` ON `meal_analysis_reviews` (`owner_id`,`expires_at`);
--> statement-breakpoint
ALTER TABLE `meal_entries` ADD `review_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_meal_entries_review_id` ON `meal_entries` (`review_id`);
