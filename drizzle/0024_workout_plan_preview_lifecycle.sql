CREATE TABLE `workout_plan_previews` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `status` text NOT NULL,
  `planning_context` text NOT NULL,
  `planning_context_digest` text NOT NULL,
  `catalog_version` text NOT NULL,
  `plan` text NOT NULL,
  `expires_at` integer NOT NULL,
  `activated_plan_id` text,
  `created_at` integer NOT NULL,
  `activated_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_workout_plan_previews_owner_status_expires` ON `workout_plan_previews` (`owner_id`,`status`,`expires_at`);
--> statement-breakpoint
ALTER TABLE `workout_plans` ADD `planning_context` text;
--> statement-breakpoint
ALTER TABLE `workout_plans` ADD `planning_context_digest` text;
--> statement-breakpoint
ALTER TABLE `workout_plans` ADD `catalog_version` text;
--> statement-breakpoint
ALTER TABLE `workout_plans` ADD `source_preview_id` text;
--> statement-breakpoint
ALTER TABLE `workout_plans` ADD `superseded_at` integer;
--> statement-breakpoint
UPDATE `workout_plans` AS `candidate`
SET `status` = 'superseded', `superseded_at` = `confirmed_at`
WHERE `status` = 'confirmed'
  AND EXISTS (
    SELECT 1 FROM `workout_plans` AS `newer`
    WHERE `newer`.`owner_id` = `candidate`.`owner_id`
      AND `newer`.`status` = 'confirmed'
      AND (
        `newer`.`created_at` > `candidate`.`created_at`
        OR (`newer`.`created_at` = `candidate`.`created_at` AND `newer`.`id` > `candidate`.`id`)
      )
  );
--> statement-breakpoint
UPDATE `workout_plans` SET `status` = 'active' WHERE `status` = 'confirmed';
--> statement-breakpoint
CREATE INDEX `idx_workout_plans_owner_status_created` ON `workout_plans` (`owner_id`,`status`,`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_workout_plans_source_preview` ON `workout_plans` (`source_preview_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_workout_plans_one_active` ON `workout_plans` (`owner_id`) WHERE `status` = 'active';
