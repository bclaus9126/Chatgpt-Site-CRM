ALTER TABLE `campaign_settings` ADD `automatic_sending_enabled` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `campaign_settings` ADD `scheduler_last_success_at` text;--> statement-breakpoint
ALTER TABLE `campaign_settings` ADD `scheduler_last_failure_at` text;--> statement-breakpoint
ALTER TABLE `campaign_settings` ADD `scheduler_last_failure_reason` text;--> statement-breakpoint
ALTER TABLE `campaign_settings` ADD `scheduler_last_processed` integer DEFAULT 0 NOT NULL;