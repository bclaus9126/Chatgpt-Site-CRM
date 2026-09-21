CREATE TABLE `webrtc_presence` (
	`id` text PRIMARY KEY NOT NULL,
	`last_seen` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`connected` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_communications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contact_id` integer,
	`type` text NOT NULL,
	`direction` text NOT NULL,
	`occurred_at` text NOT NULL,
	`subject` text,
	`message_transcript` text,
	`duration_seconds` integer,
	`recording_url` text,
	`ai_summary` text,
	`external_provider_id` text,
	`from_number` text,
	`to_number` text,
	`call_control_id` text,
	`call_leg_id` text,
	`started_at` text,
	`answered_at` text,
	`ended_at` text,
	`status` text,
	`is_sample` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_communications`("id", "contact_id", "type", "direction", "occurred_at", "subject", "message_transcript", "duration_seconds", "recording_url", "ai_summary", "external_provider_id", "from_number", "to_number", "call_control_id", "call_leg_id", "started_at", "answered_at", "ended_at", "status", "is_sample") SELECT "id", "contact_id", "type", "direction", "occurred_at", "subject", "message_transcript", "duration_seconds", "recording_url", "ai_summary", "external_provider_id", NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, "is_sample" FROM `communications`;--> statement-breakpoint
DROP TABLE `communications`;--> statement-breakpoint
ALTER TABLE `__new_communications` RENAME TO `communications`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `communications_external_provider_id_unique` ON `communications` (`external_provider_id`);--> statement-breakpoint
CREATE INDEX `idx_communications_contact_id` ON `communications` (`contact_id`);--> statement-breakpoint
CREATE INDEX `idx_communications_call_control_id` ON `communications` (`call_control_id`);
