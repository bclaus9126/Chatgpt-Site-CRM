ALTER TABLE `tasks` ADD `source_system` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `source_record_id` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `ai_extracted` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `opportunities` DROP COLUMN `ai_extracted`;