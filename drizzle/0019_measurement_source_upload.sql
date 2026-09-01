ALTER TABLE `measurements` ADD `source_upload_id` text;
--> statement-breakpoint
CREATE INDEX `idx_measurements_owner_source_upload` ON `measurements` (`owner_id`,`source_upload_id`);
