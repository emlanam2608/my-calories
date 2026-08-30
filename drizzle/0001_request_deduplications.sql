CREATE TABLE `request_deduplications` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `idempotency_key` text NOT NULL,
  `resource_type` text NOT NULL,
  `resource_id` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_request_dedup_owner_key` ON `request_deduplications` (`owner_id`,`idempotency_key`);
