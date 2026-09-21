CREATE TABLE `telnyx_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` text NOT NULL,
	`event_type` text NOT NULL,
	`call_control_id` text,
	`call_leg_id` text,
	`call_session_id` text,
	`from_number` text,
	`to_number` text,
	`direction` text,
	`payload` text NOT NULL,
	`received_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `telnyx_events_event_id_unique` ON `telnyx_events` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_telnyx_events_received_at` ON `telnyx_events` (`received_at`);--> statement-breakpoint
CREATE INDEX `idx_telnyx_events_type_received` ON `telnyx_events` (`event_type`,`received_at`);
