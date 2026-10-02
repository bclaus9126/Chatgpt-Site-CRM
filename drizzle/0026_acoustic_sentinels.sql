ALTER TABLE `contacts` ADD `sms_consent` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` ADD `sms_opt_out` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` ADD `email_consent` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` ADD `email_unsubscribed` integer DEFAULT 0 NOT NULL;