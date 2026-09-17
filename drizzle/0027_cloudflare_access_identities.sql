CREATE TABLE `auth_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`provider` text NOT NULL,
	`issuer` text NOT NULL,
	`subject` text NOT NULL,
	`email_at_link` text NOT NULL,
	`linked_at` integer NOT NULL,
	CONSTRAINT `auth_identities_provider_check` CHECK(`provider` = 'cloudflare_access')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_auth_identities_provider_issuer_subject` ON `auth_identities` (`provider`,`issuer`,`subject`);
--> statement-breakpoint
CREATE INDEX `idx_auth_identities_owner` ON `auth_identities` (`owner_id`);
