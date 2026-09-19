CREATE TABLE `activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contact_id` integer NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`detail` text,
	`occurred_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`source_id` integer,
	`is_sample` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `communications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contact_id` integer NOT NULL,
	`type` text NOT NULL,
	`direction` text NOT NULL,
	`occurred_at` text NOT NULL,
	`subject` text,
	`message_transcript` text,
	`duration_seconds` integer,
	`recording_url` text,
	`ai_summary` text,
	`external_provider_id` text,
	`is_sample` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`phone` text,
	`email` text,
	`address` text,
	`preferred_contact` text,
	`relationship` text DEFAULT 'Lead' NOT NULL,
	`lead_source` text,
	`lead_source_detail` text,
	`campaign` text,
	`ad_landing_page` text,
	`intent` text DEFAULT 'Unknown' NOT NULL,
	`target_locations` text,
	`price_range` text,
	`financing_type` text,
	`pre_approved` integer,
	`desired_property` text,
	`desired_move_date` text,
	`property_address` text,
	`selling_timeline` text,
	`selling_reason` text,
	`property_status` text,
	`relationship_summary` text,
	`motivation` text,
	`concerns` text,
	`objections` text,
	`contextual_notes` text,
	`estimated_timeline` text,
	`temperature` text DEFAULT 'Warm' NOT NULL,
	`last_meaningful_contact` text,
	`next_follow_up` text,
	`recommended_next_action` text,
	`last_ai_summary_at` text,
	`tags` text,
	`is_sample` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contact_id` integer NOT NULL,
	`body` text NOT NULL,
	`is_sample` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `opportunities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contact_id` integer NOT NULL,
	`type` text NOT NULL,
	`stage` text NOT NULL,
	`estimated_price` real,
	`estimated_commission` real,
	`probability` integer,
	`expected_timeframe` text,
	`property_address` text,
	`notes` text,
	`is_sample` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `properties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contact_id` integer NOT NULL,
	`address` text NOT NULL,
	`relationship` text,
	`status` text,
	`notes` text,
	`is_sample` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contact_id` integer,
	`opportunity_id` integer,
	`title` text NOT NULL,
	`type` text DEFAULT 'Task' NOT NULL,
	`due_date` text NOT NULL,
	`due_time` text,
	`priority` text DEFAULT 'Normal' NOT NULL,
	`status` text DEFAULT 'Open' NOT NULL,
	`notes` text,
	`is_sample` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE no action
);
