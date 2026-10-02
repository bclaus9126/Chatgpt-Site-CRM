CREATE TABLE `campaign_enrollments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contact_id` integer NOT NULL,
	`campaign_id` integer NOT NULL,
	`lead_subtype` text,
	`enrolled_at` text NOT NULL,
	`current_step_id` integer,
	`next_action_at` text,
	`status` text DEFAULT 'active' NOT NULL,
	`paused_at` text,
	`completed_at` text,
	`stopped_at` text,
	`stopped_reason` text,
	`test_mode` integer DEFAULT 0 NOT NULL,
	`test_interval_minutes` integer,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign_templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`current_step_id`) REFERENCES `campaign_steps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_campaign_due` ON `campaign_enrollments` (`status`,`next_action_at`);--> statement-breakpoint
CREATE INDEX `idx_campaign_contact` ON `campaign_enrollments` (`contact_id`);--> statement-breakpoint
CREATE TABLE `campaign_executions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`enrollment_id` integer NOT NULL,
	`step_id` integer NOT NULL,
	`scheduled_at` text NOT NULL,
	`executed_at` text,
	`channel` text NOT NULL,
	`template_id` integer,
	`ai_used` integer DEFAULT 0 NOT NULL,
	`ai_failure` text,
	`final_content` text,
	`provider_id` text,
	`communication_id` integer,
	`task_id` integer,
	`status` text NOT NULL,
	`skipped_reason` text,
	`error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`enrollment_id`) REFERENCES `campaign_enrollments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`step_id`) REFERENCES `campaign_steps`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`communication_id`) REFERENCES `communications`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_campaign_execution_once` ON `campaign_executions` (`enrollment_id`,`step_id`);--> statement-breakpoint
CREATE INDEX `idx_campaign_execution_status` ON `campaign_executions` (`status`);--> statement-breakpoint
CREATE TABLE `campaign_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`channel` text NOT NULL,
	`lead_subtype` text,
	`subject` text,
	`body` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `campaign_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`message_start` text DEFAULT '08:00' NOT NULL,
	`message_end` text DEFAULT '19:00' NOT NULL,
	`call_start` text DEFAULT '09:00' NOT NULL,
	`call_end` text DEFAULT '18:00' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `campaign_steps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`day_number` integer NOT NULL,
	`sequence_order` integer NOT NULL,
	`channel` text NOT NULL,
	`relative_delay` integer DEFAULT 0 NOT NULL,
	`scheduled_time` text DEFAULT '10:00' NOT NULL,
	`template_id` integer,
	`execution_mode` text NOT NULL,
	`ai_personalization_enabled` integer DEFAULT 0 NOT NULL,
	`skip_conditions` text DEFAULT '{}' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign_templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `campaign_messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_campaign_steps_order` ON `campaign_steps` (`campaign_id`,`day_number`,`sequence_order`);--> statement-breakpoint
CREATE TABLE `campaign_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`campaign_type` text NOT NULL,
	`active` integer DEFAULT 0 NOT NULL,
	`entry_criteria` text DEFAULT '{}' NOT NULL,
	`stop_conditions` text DEFAULT '{}' NOT NULL,
	`completion_behavior` text DEFAULT 'stop' NOT NULL,
	`next_campaign_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
