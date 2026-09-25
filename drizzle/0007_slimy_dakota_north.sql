CREATE TABLE `communication_suggestions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`communication_id` integer NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`detail` text,
	`due_date` text,
	`field_name` text,
	`field_value` text,
	`status` text DEFAULT 'Suggested' NOT NULL,
	`ai_extracted` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`communication_id`) REFERENCES `communications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_suggestions_communication` ON `communication_suggestions` (`communication_id`);--> statement-breakpoint
ALTER TABLE `communications` ADD `audio_object_key` text;--> statement-breakpoint
ALTER TABLE `communications` ADD `audio_content_type` text;--> statement-breakpoint
ALTER TABLE `communications` ADD `interaction_type` text;--> statement-breakpoint
ALTER TABLE `communications` ADD `author_name` text;--> statement-breakpoint
ALTER TABLE `communications` ADD `transcription_status` text;--> statement-breakpoint
ALTER TABLE `communications` ADD `transcript_timestamps` text;--> statement-breakpoint
ALTER TABLE `communications` ADD `analysis_status` text;