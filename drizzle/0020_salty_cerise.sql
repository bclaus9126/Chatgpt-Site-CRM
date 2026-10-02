CREATE TABLE `claus_ai_index_queue` (
	`source_kind` text NOT NULL,
	`source_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`source_key` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
DROP INDEX `idx_ai_embedding_source_model`;--> statement-breakpoint
ALTER TABLE `claus_ai_embeddings` ADD `chunk_index` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `claus_ai_embeddings` ADD `content` text;--> statement-breakpoint
ALTER TABLE `claus_ai_embeddings` ADD `source_type` text;--> statement-breakpoint
ALTER TABLE `claus_ai_embeddings` ADD `sender` text;--> statement-breakpoint
ALTER TABLE `claus_ai_embeddings` ADD `recipient` text;--> statement-breakpoint
ALTER TABLE `claus_ai_embeddings` ADD `thread_id` text;--> statement-breakpoint
ALTER TABLE `claus_ai_embeddings` ADD `indexed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ai_embedding_source_chunk_model` ON `claus_ai_embeddings` (`source_kind`,`source_id`,`chunk_index`,`provider`,`model`);--> statement-breakpoint
CREATE TRIGGER ai_comm_insert AFTER INSERT ON communications BEGIN INSERT INTO claus_ai_index_queue(source_kind,source_id,source_key) VALUES('communication',NEW.id,'communication:'||NEW.id) ON CONFLICT(source_key) DO UPDATE SET status='pending',error=NULL,updated_at=CURRENT_TIMESTAMP; END;
--> statement-breakpoint
CREATE TRIGGER ai_comm_update AFTER UPDATE OF message_transcript,ai_summary,subject,contact_id,occurred_at,author_name,participants ON communications BEGIN DELETE FROM claus_ai_embeddings WHERE source_kind='communication' AND source_id=NEW.id; INSERT INTO claus_ai_index_queue(source_kind,source_id,source_key) VALUES('communication',NEW.id,'communication:'||NEW.id) ON CONFLICT(source_key) DO UPDATE SET status='pending',error=NULL,updated_at=CURRENT_TIMESTAMP; END;
--> statement-breakpoint
CREATE TRIGGER ai_comm_delete AFTER DELETE ON communications BEGIN DELETE FROM claus_ai_embeddings WHERE source_kind='communication' AND source_id=OLD.id; DELETE FROM claus_ai_index_queue WHERE source_key='communication:'||OLD.id; END;
--> statement-breakpoint
CREATE TRIGGER ai_note_insert AFTER INSERT ON notes BEGIN INSERT INTO claus_ai_index_queue(source_kind,source_id,source_key) VALUES('note',NEW.id,'note:'||NEW.id) ON CONFLICT(source_key) DO UPDATE SET status='pending',error=NULL,updated_at=CURRENT_TIMESTAMP; END;
--> statement-breakpoint
CREATE TRIGGER ai_note_update AFTER UPDATE OF body,contact_id ON notes BEGIN DELETE FROM claus_ai_embeddings WHERE source_kind='note' AND source_id=NEW.id; INSERT INTO claus_ai_index_queue(source_kind,source_id,source_key) VALUES('note',NEW.id,'note:'||NEW.id) ON CONFLICT(source_key) DO UPDATE SET status='pending',error=NULL,updated_at=CURRENT_TIMESTAMP; END;
--> statement-breakpoint
CREATE TRIGGER ai_note_delete AFTER DELETE ON notes BEGIN DELETE FROM claus_ai_embeddings WHERE source_kind='note' AND source_id=OLD.id; DELETE FROM claus_ai_index_queue WHERE source_key='note:'||OLD.id; END;
--> statement-breakpoint
CREATE TRIGGER ai_fact_insert AFTER INSERT ON contact_intelligence WHEN NEW.status='Current' BEGIN INSERT INTO claus_ai_index_queue(source_kind,source_id,source_key) VALUES('intelligence',NEW.id,'intelligence:'||NEW.id) ON CONFLICT(source_key) DO UPDATE SET status='pending',error=NULL,updated_at=CURRENT_TIMESTAMP; END;
--> statement-breakpoint
CREATE TRIGGER ai_fact_update AFTER UPDATE OF field_name,value,status,contact_id,source_date ON contact_intelligence BEGIN DELETE FROM claus_ai_embeddings WHERE source_kind='intelligence' AND source_id=NEW.id; INSERT INTO claus_ai_index_queue(source_kind,source_id,source_key) VALUES('intelligence',NEW.id,'intelligence:'||NEW.id) ON CONFLICT(source_key) DO UPDATE SET status='pending',error=NULL,updated_at=CURRENT_TIMESTAMP; END;
--> statement-breakpoint
CREATE TRIGGER ai_fact_delete AFTER DELETE ON contact_intelligence BEGIN DELETE FROM claus_ai_embeddings WHERE source_kind='intelligence' AND source_id=OLD.id; DELETE FROM claus_ai_index_queue WHERE source_key='intelligence:'||OLD.id; END;
--> statement-breakpoint
INSERT INTO claus_ai_index_queue(source_kind,source_id,source_key) SELECT 'communication',id,'communication:'||id FROM communications WHERE length(trim(coalesce(message_transcript,'')||coalesce(ai_summary,'')||coalesce(subject,'')))>0;
--> statement-breakpoint
INSERT INTO claus_ai_index_queue(source_kind,source_id,source_key) SELECT 'note',id,'note:'||id FROM notes WHERE length(trim(coalesce(body,'')))>0;
--> statement-breakpoint
INSERT INTO claus_ai_index_queue(source_kind,source_id,source_key) SELECT 'intelligence',id,'intelligence:'||id FROM contact_intelligence WHERE status='Current' AND length(trim(coalesce(value,'')))>0;
