CREATE TABLE `ai_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`monthly_target_usd` real,
	`monthly_warning_usd` real,
	`monthly_hard_limit_usd` real,
	`daily_hard_limit_usd` real,
	`max_request_cost_usd` real,
	`auto_generate_message_drafts` integer DEFAULT false NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`billing_day` text NOT NULL,
	`billing_month` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`tier` text NOT NULL,
	`task_type` text NOT NULL,
	`contact_id` integer,
	`source_id` text,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cached_tokens` integer DEFAULT 0 NOT NULL,
	`reserved_usd` real NOT NULL,
	`estimated_usd` real NOT NULL,
	`actual_usd` real,
	`status` text NOT NULL,
	`error_code` text
);
--> statement-breakpoint
CREATE INDEX `idx_ai_usage_day` ON `ai_usage` (`billing_day`);--> statement-breakpoint
CREATE INDEX `idx_ai_usage_month` ON `ai_usage` (`billing_month`);--> statement-breakpoint
CREATE INDEX `idx_ai_usage_task` ON `ai_usage` (`task_type`);