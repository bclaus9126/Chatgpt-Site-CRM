ALTER TABLE `contacts` ADD `display_name` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `additional_phones` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `phone_type` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `additional_emails` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `email_type` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `spouse_name` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `updated_by` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `update_source` text;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `details` text;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `updated_by` text;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `update_source` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `details` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `updated_at` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `updated_by` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `update_source` text;