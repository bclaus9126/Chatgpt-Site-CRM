CREATE TABLE `telnyx_call_flows` (
	`id` text PRIMARY KEY NOT NULL,
	`communication_id` integer NOT NULL,
	`direction` text NOT NULL,
	`contact_id` integer,
	`contact_number` text,
	`call_session_id` text,
	`primary_call_control_id` text,
	`brad_call_control_id` text,
	`contact_call_control_id` text,
	`connection_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`communication_id`) REFERENCES `communications`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `telnyx_call_flows_call_session_id_unique` ON `telnyx_call_flows` (`call_session_id`);--> statement-breakpoint
CREATE INDEX `idx_telnyx_call_flows_communication` ON `telnyx_call_flows` (`communication_id`);--> statement-breakpoint
CREATE INDEX `idx_telnyx_call_flows_session` ON `telnyx_call_flows` (`call_session_id`);--> statement-breakpoint
ALTER TABLE `communications` ADD `recording_id` text;--> statement-breakpoint
ALTER TABLE `communications` ADD `call_outcome` text;--> statement-breakpoint
ALTER TABLE `communications` ADD `follow_up_suggestion` text;--> statement-breakpoint
ALTER TABLE `communications` ADD `caller_number` text;--> statement-breakpoint
ALTER TABLE `communications` ADD `destination_number` text;--> statement-breakpoint
ALTER TABLE `communications` ADD `brad_cell_number` text;--> statement-breakpoint
ALTER TABLE `communications` ADD `business_number` text;--> statement-breakpoint
ALTER TABLE `communications` ADD `related_call_leg_ids` text;--> statement-breakpoint
ALTER TABLE `communications` ADD `bridged_at` text;