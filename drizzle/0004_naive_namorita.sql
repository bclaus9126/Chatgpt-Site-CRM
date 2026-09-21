CREATE TABLE `telnyx_webrtc_credentials` (
	`identity` text PRIMARY KEY NOT NULL,
	`credential_id` text NOT NULL,
	`sip_username` text NOT NULL,
	`expires_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `telnyx_webrtc_credentials_credential_id_unique` ON `telnyx_webrtc_credentials` (`credential_id`);