CREATE TABLE `microsoft_mail_connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_user_id` text NOT NULL,
	`mailbox` text NOT NULL,
	`graph_user_id` text NOT NULL,
	`encrypted_refresh_token` text NOT NULL,
	`subscription_id` text,
	`client_state` text,
	`subscription_expires_at` text,
	`last_synced_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_microsoft_mail_connections_mailbox` ON `microsoft_mail_connections` (`mailbox`);--> statement-breakpoint
CREATE TABLE `microsoft_oauth_states` (
	`state` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`verifier` text NOT NULL,
	`expires_at` text NOT NULL
);
