ALTER TABLE `campaign_enrollments` ADD `scheduled_test` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `campaign_enrollments` ADD `schedule_anchor_at` text;