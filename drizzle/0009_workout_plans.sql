CREATE TABLE `workout_plans` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `plan_version` text NOT NULL,
  `period_start` text NOT NULL,
  `status` text NOT NULL,
  `plan` text NOT NULL,
  `created_at` integer NOT NULL,
  `confirmed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_workout_plans_owner_created` ON `workout_plans` (`owner_id`,`created_at`);
