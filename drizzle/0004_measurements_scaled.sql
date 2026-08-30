CREATE TABLE `measurements_next` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`metric` text NOT NULL,
	`value_scaled` integer NOT NULL,
	`secondary_value_scaled` integer,
	`value_scale` integer NOT NULL,
	`unit` text NOT NULL,
	`source` text NOT NULL,
	`confirmation_status` text NOT NULL,
	`provenance` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `measurements_next` (`id`, `owner_id`, `metric`, `value_scaled`, `secondary_value_scaled`, `value_scale`, `unit`, `source`, `confirmation_status`, `provenance`, `occurred_at`, `created_at`)
SELECT `id`, `owner_id`, `metric`, CAST(ROUND(CAST(`value` AS REAL) * 100) AS INTEGER), NULL, 100, `unit`, `source`, 'confirmed', 'legacy_import', `occurred_at`, `occurred_at` FROM `measurements`;
--> statement-breakpoint
DROP TABLE `measurements`;
--> statement-breakpoint
ALTER TABLE `measurements_next` RENAME TO `measurements`;
--> statement-breakpoint
CREATE INDEX `idx_measurements_owner_metric_date` ON `measurements` (`owner_id`,`metric`,`occurred_at`);
