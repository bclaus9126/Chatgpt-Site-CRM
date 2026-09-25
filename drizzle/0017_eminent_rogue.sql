CREATE TABLE `claus_ai_drafts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`turn_id` integer,
	`contact_id` integer NOT NULL,
	`communication_id` integer NOT NULL,
	`medium` text NOT NULL,
	`generated_draft` text NOT NULL,
	`facts_used` text,
	`open_questions` text,
	`risk_flags` text,
	`status` text DEFAULT 'Suggested' NOT NULL,
	`final_version` text,
	`reviewed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`turn_id`) REFERENCES `claus_ai_turns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`communication_id`) REFERENCES `communications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ai_drafts_communication` ON `claus_ai_drafts` (`communication_id`);--> statement-breakpoint
CREATE TABLE `claus_ai_turns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`conversation_id` text NOT NULL,
	`question` text NOT NULL,
	`answer` text,
	`tools` text,
	`evidence` text,
	`provider` text,
	`model` text,
	`usage` text,
	`elapsed_ms` integer,
	`error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ai_turns_conversation` ON `claus_ai_turns` (`conversation_id`,`id`);