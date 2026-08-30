CREATE TABLE `uploads` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `storage_key` text NOT NULL,
  `kind` text NOT NULL,
  `content_type` text NOT NULL,
  `byte_size` integer NOT NULL,
  `width` integer NOT NULL,
  `height` integer NOT NULL,
  `status` text NOT NULL,
  `expires_at` integer NOT NULL,
  `created_at` integer NOT NULL,
  `deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_uploads_owner_status` ON `uploads` (`owner_id`, `status`);
--> statement-breakpoint
CREATE INDEX `idx_uploads_expiry` ON `uploads` (`status`, `expires_at`);
