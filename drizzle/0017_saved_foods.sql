CREATE TABLE `saved_foods` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `kind` text NOT NULL,
  `name` text NOT NULL,
  `name_vi` text NOT NULL,
  `normalized_name` text NOT NULL,
  `nutrition_snapshot` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_saved_foods_owner_normalized` ON `saved_foods` (`owner_id`, `normalized_name`);
--> statement-breakpoint
CREATE INDEX `idx_saved_foods_owner_updated` ON `saved_foods` (`owner_id`, `updated_at`);
