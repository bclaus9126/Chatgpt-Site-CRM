CREATE TABLE `claus_ai_embeddings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_kind` text NOT NULL,
	`source_id` integer NOT NULL,
	`contact_id` integer,
	`occurred_at` text,
	`content_hash` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`vector_json` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ai_embedding_source_model` ON `claus_ai_embeddings` (`source_kind`,`source_id`,`provider`,`model`);