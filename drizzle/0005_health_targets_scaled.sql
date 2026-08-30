CREATE TABLE `health_targets_next` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`metric` text NOT NULL,
	`value_scaled` integer NOT NULL,
	`value_scale` integer NOT NULL,
	`unit` text NOT NULL,
	`authority` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `health_targets_next` (`id`, `owner_id`, `metric`, `value_scaled`, `value_scale`, `unit`, `authority`, `updated_at`)
SELECT `id`, `owner_id`, `metric`, CAST(ROUND(CAST(`value` AS REAL) * 100) AS INTEGER), 100, `unit`, `authority`, `updated_at` FROM `health_targets`;
--> statement-breakpoint
DROP TABLE `health_targets`;
--> statement-breakpoint
ALTER TABLE `health_targets_next` RENAME TO `health_targets`;
--> statement-breakpoint
CREATE INDEX `idx_health_targets_owner_metric` ON `health_targets` (`owner_id`,`metric`);
