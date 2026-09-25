ALTER TABLE `communication_suggestions` ADD `due_time` text;--> statement-breakpoint
ALTER TABLE `communication_suggestions` ADD `commitment` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `communication_suggestions` ADD `source_excerpt` text;--> statement-breakpoint
ALTER TABLE `communication_suggestions` ADD `needs_review` integer DEFAULT false NOT NULL;