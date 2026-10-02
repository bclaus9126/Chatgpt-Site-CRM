CREATE TABLE `webhook_diagnostics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`reason` text NOT NULL,
	`signature_present` integer NOT NULL,
	`timestamp_present` integer NOT NULL,
	`body_bytes` integer NOT NULL,
	`timestamp` text,
	`key_format` text NOT NULL,
	`key_has_whitespace` integer NOT NULL,
	`key_has_quotes` integer NOT NULL,
	`body_sha256` text NOT NULL,
	`signature_sha256` text
);
