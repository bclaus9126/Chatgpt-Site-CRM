CREATE TABLE `contact_intelligence` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contact_id` integer NOT NULL,
	`import_job_id` integer,
	`category` text NOT NULL,
	`field_name` text NOT NULL,
	`value` text NOT NULL,
	`status` text DEFAULT 'Current' NOT NULL,
	`source_system` text NOT NULL,
	`source_record_id` text,
	`source_field` text,
	`source_date` text,
	`confidence` real DEFAULT 1 NOT NULL,
	`superseded_at` text,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`import_job_id`) REFERENCES `import_jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_contact_intelligence_contact` ON `contact_intelligence` (`contact_id`);--> statement-breakpoint
CREATE TABLE `contact_methods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contact_id` integer NOT NULL,
	`import_job_id` integer,
	`kind` text NOT NULL,
	`value` text NOT NULL,
	`normalized_value` text,
	`label` text,
	`source_system` text,
	`is_primary` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`import_job_id`) REFERENCES `import_jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_contact_methods_contact` ON `contact_methods` (`contact_id`);--> statement-breakpoint
CREATE TABLE `contact_relationships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contact_id` integer NOT NULL,
	`related_contact_id` integer,
	`import_job_id` integer,
	`relationship_type` text NOT NULL,
	`related_first_name` text,
	`related_last_name` text,
	`source_system` text,
	`source_field` text,
	`source_date` text,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`related_contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`import_job_id`) REFERENCES `import_jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_contact_relationships_contact` ON `contact_relationships` (`contact_id`);--> statement-breakpoint
CREATE TABLE `import_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_name` text NOT NULL,
	`source_system` text NOT NULL,
	`total_rows` integer DEFAULT 0 NOT NULL,
	`imported_records` integer DEFAULT 0 NOT NULL,
	`updated_records` integer DEFAULT 0 NOT NULL,
	`skipped_records` integer DEFAULT 0 NOT NULL,
	`duplicate_records` integer DEFAULT 0 NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL,
	`warning_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'Processing' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	`rolled_back_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_import_jobs_created_at` ON `import_jobs` (`created_at`);--> statement-breakpoint
CREATE TABLE `import_rows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`import_job_id` integer NOT NULL,
	`row_number` integer NOT NULL,
	`external_fub_id` text,
	`contact_id` integer,
	`status` text NOT NULL,
	`match_type` text,
	`warning` text,
	`error` text,
	`raw_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`import_job_id`) REFERENCES `import_jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_import_rows_job` ON `import_rows` (`import_job_id`);--> statement-breakpoint
CREATE INDEX `idx_import_rows_external_fub` ON `import_rows` (`external_fub_id`);--> statement-breakpoint
CREATE TABLE `relationship_moments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contact_id` integer NOT NULL,
	`import_job_id` integer,
	`type` text NOT NULL,
	`date_value` text NOT NULL,
	`label` text NOT NULL,
	`source_system` text NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`import_job_id`) REFERENCES `import_jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_relationship_moments_contact` ON `relationship_moments` (`contact_id`);--> statement-breakpoint
ALTER TABLE `communications` ADD `import_job_id` integer REFERENCES import_jobs(id);--> statement-breakpoint
ALTER TABLE `communications` ADD `source_system` text;--> statement-breakpoint
ALTER TABLE `communications` ADD `source_record_id` text;--> statement-breakpoint
ALTER TABLE `communications` ADD `participants` text;--> statement-breakpoint
ALTER TABLE `communications` ADD `imported` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `communications` ADD `original_imported_text` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `external_fub_id` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `source_system` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `import_job_id` integer;--> statement-breakpoint
ALTER TABLE `contacts` ADD `birthday` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `date_added` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `stage` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `timeframe` text;--> statement-breakpoint
ALTER TABLE `notes` ADD `import_job_id` integer REFERENCES import_jobs(id);--> statement-breakpoint
ALTER TABLE `notes` ADD `source_system` text;--> statement-breakpoint
ALTER TABLE `notes` ADD `source_record_id` text;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `import_job_id` integer REFERENCES import_jobs(id);--> statement-breakpoint
ALTER TABLE `opportunities` ADD `source_system` text;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `source_record_id` text;--> statement-breakpoint
ALTER TABLE `properties` ADD `import_job_id` integer REFERENCES import_jobs(id);--> statement-breakpoint
ALTER TABLE `properties` ADD `source_system` text;--> statement-breakpoint
ALTER TABLE `properties` ADD `external_record_id` text;