ALTER TABLE `workout_plans` ADD `source_proposal_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_workout_plans_source_proposal` ON `workout_plans` (`source_proposal_id`);
--> statement-breakpoint
CREATE TABLE `workout_adaptation_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`proposal_version` text NOT NULL,
	`status` text NOT NULL,
	`action` text NOT NULL,
	`base_plan_id` text NOT NULL,
	`base_plan_version` text NOT NULL,
	`policy_version` text NOT NULL,
	`policy_review_status` text NOT NULL,
	`catalog_version` text NOT NULL,
	`safety_context_version` text NOT NULL,
	`input_digest` text NOT NULL,
	`evidence_record_ids` text NOT NULL,
	`data_completeness` text NOT NULL,
	`confidence` text NOT NULL,
	`reason_codes` text NOT NULL,
	`changes` text NOT NULL,
	`unresolved_questions` text NOT NULL,
	`proposed_plan` text,
	`source_checkin_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`confirmed_plan_id` text,
	`created_at` integer NOT NULL,
	`confirmed_at` integer,
	`dismissed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_workout_proposals_source_checkin` ON `workout_adaptation_proposals` (`source_checkin_id`);
--> statement-breakpoint
CREATE INDEX `idx_workout_proposals_owner_base_created` ON `workout_adaptation_proposals` (`owner_id`,`base_plan_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_workout_proposals_owner_status_expires` ON `workout_adaptation_proposals` (`owner_id`,`status`,`expires_at`);
