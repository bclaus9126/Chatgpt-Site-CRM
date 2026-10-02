CREATE TABLE `campaign_step_templates` (
	`step_id` integer NOT NULL,
	`lead_subtype` text NOT NULL,
	`template_id` integer NOT NULL,
	FOREIGN KEY (`step_id`) REFERENCES `campaign_steps`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `campaign_messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_campaign_step_subtype` ON `campaign_step_templates` (`step_id`,`lead_subtype`);