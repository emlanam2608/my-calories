ALTER TABLE `exercise_catalog` ADD `environments` text NOT NULL DEFAULT '["home","gym"]';
--> statement-breakpoint
ALTER TABLE `exercise_catalog` ADD `review_status` text NOT NULL DEFAULT 'unreviewed';
--> statement-breakpoint
ALTER TABLE `exercise_catalog` ADD `reviewed_version` text;
--> statement-breakpoint
ALTER TABLE `exercise_catalog` ADD `reviewed_at` text;
--> statement-breakpoint
ALTER TABLE `exercise_catalog` ADD `review_reference` text;
--> statement-breakpoint
UPDATE `exercise_catalog` SET
  `equipment` = CASE `id`
    WHEN 'cat-cow' THEN '["exercise_mat"]'
    WHEN 'sit-to-stand' THEN '["chair"]'
    WHEN 'wall-push-up' THEN '["wall"]'
    WHEN 'bicycle-easy' THEN '["bicycle"]'
    WHEN 'treadmill-walk' THEN '["mini_treadmill"]'
    WHEN 'band-row' THEN '["resistance_band","band_anchor"]'
    WHEN 'chair-march' THEN '["chair"]'
    WHEN 'dumbbell-floor-press' THEN '["dumbbells","exercise_mat"]'
    WHEN 'dumbbell-hip-hinge' THEN '["dumbbells"]'
    WHEN 'gym-cable-row' THEN '["gym","cable_machine"]'
    ELSE `equipment`
  END,
  `environments` = CASE `id`
    WHEN 'bicycle-easy' THEN '["home","outdoors","gym"]'
    WHEN 'gym-cable-row' THEN '["gym"]'
    ELSE '["home","gym"]'
  END,
  `catalog_version` = 'starter-2',
  `review_status` = 'unreviewed',
  `reviewed_version` = NULL,
  `reviewed_at` = NULL,
  `review_reference` = NULL
WHERE `catalog_version` = 'starter-1';
--> statement-breakpoint
CREATE INDEX `idx_exercise_catalog_version_category` ON `exercise_catalog` (`catalog_version`,`category`);
