ALTER TABLE `microsoft_mail_connections` ADD `calendar_enabled` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `microsoft_event_id` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `microsoft_calendar_id` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `calendar_sync_status` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `calendar_sync_error` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `last_calendar_sync_at` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `calendar_transaction_id` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `calendar_change_key` text;