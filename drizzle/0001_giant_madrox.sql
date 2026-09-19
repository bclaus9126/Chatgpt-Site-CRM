CREATE INDEX `idx_activities_contact_occurred` ON `activities` (`contact_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_notes_contact_created` ON `notes` (`contact_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_opportunities_contact_id` ON `opportunities` (`contact_id`);--> statement-breakpoint
CREATE INDEX `idx_opportunities_stage` ON `opportunities` (`stage`);--> statement-breakpoint
CREATE INDEX `idx_tasks_status_due_date` ON `tasks` (`status`,`due_date`);--> statement-breakpoint
CREATE INDEX `idx_tasks_contact_id` ON `tasks` (`contact_id`);