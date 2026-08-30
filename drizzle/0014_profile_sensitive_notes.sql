CREATE TABLE `profile_sensitive_notes` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `ciphertext` text NOT NULL,
  `key_version` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_profile_sensitive_notes_owner` ON `profile_sensitive_notes` (`owner_id`);
