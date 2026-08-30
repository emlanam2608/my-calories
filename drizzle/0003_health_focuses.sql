CREATE TABLE `health_focuses` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `focus` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_health_focuses_owner_focus` ON `health_focuses` (`owner_id`,`focus`);
