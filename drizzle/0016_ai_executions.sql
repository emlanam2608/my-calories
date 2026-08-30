CREATE TABLE `ai_executions` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `upload_id` text,
  `feature` text NOT NULL,
  `model` text NOT NULL,
  `prompt_version` text NOT NULL,
  `schema_version` text NOT NULL,
  `status` text NOT NULL,
  `latency_ms` integer NOT NULL,
  `failure_code` text,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ai_executions_owner_created` ON `ai_executions` (`owner_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `idx_ai_executions_upload` ON `ai_executions` (`upload_id`, `created_at`);
