CREATE TABLE `profile_onboarding` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `draft` text NOT NULL,
  `status` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_profile_onboarding_owner` ON `profile_onboarding` (`owner_id`);
