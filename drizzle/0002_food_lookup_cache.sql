CREATE TABLE `food_lookup_cache` (
  `cache_key` text PRIMARY KEY NOT NULL,
  `provider` text NOT NULL,
  `analysis` text NOT NULL,
  `expires_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_food_lookup_cache_expiry` ON `food_lookup_cache` (`expires_at`);
