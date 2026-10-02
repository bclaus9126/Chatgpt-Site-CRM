CREATE TABLE `push_deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`communication_id` integer NOT NULL,
	`endpoint` text NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`communication_id`) REFERENCES `communications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_push_delivery_once` ON `push_deliveries` (`communication_id`,`endpoint`,`type`);--> statement-breakpoint
CREATE TABLE `push_settings` (
	`owner_user_id` text PRIMARY KEY NOT NULL,
	`inbound_sms` integer DEFAULT 1 NOT NULL,
	`unknown_sms` integer DEFAULT 1 NOT NULL,
	`preview` integer DEFAULT 1 NOT NULL,
	`quiet_hours` integer DEFAULT 0 NOT NULL,
	`quiet_start` text DEFAULT '22:00' NOT NULL,
	`quiet_end` text DEFAULT '07:00' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`endpoint` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`device_name` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
