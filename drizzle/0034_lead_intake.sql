CREATE TABLE lead_intakes (id INTEGER PRIMARY KEY AUTOINCREMENT,contact_id INTEGER REFERENCES contacts(id),provider TEXT NOT NULL,external_lead_id TEXT NOT NULL,source TEXT NOT NULL,subtype TEXT NOT NULL,campaign TEXT,property TEXT,message TEXT,notes TEXT,received_at TEXT NOT NULL,raw_payload TEXT NOT NULL,metadata TEXT NOT NULL,processing_status TEXT NOT NULL DEFAULT 'received',dedupe_result TEXT,enrollment_id INTEGER,enrollment_reason TEXT,live INTEGER NOT NULL DEFAULT 1,is_test INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(provider,external_lead_id));
--> statement-breakpoint
CREATE INDEX lead_intakes_contact ON lead_intakes(contact_id,received_at);
--> statement-breakpoint
CREATE TABLE lead_sources (provider TEXT PRIMARY KEY,active INTEGER NOT NULL DEFAULT 0,campaign_id INTEGER REFERENCES campaign_templates(id),current_destination TEXT DEFAULT 'Not verified',live_test_passed INTEGER NOT NULL DEFAULT 0,intentionally_disabled INTEGER NOT NULL DEFAULT 0,last_error TEXT,last_error_at TEXT);
--> statement-breakpoint
INSERT INTO lead_sources(provider) VALUES ('website'),('facebook'),('zillow'),('homes'),('generic'),('email');
--> statement-breakpoint
CREATE TABLE lead_notification_deliveries (id INTEGER PRIMARY KEY AUTOINCREMENT,intake_id INTEGER NOT NULL REFERENCES lead_intakes(id) ON DELETE CASCADE,channel TEXT NOT NULL,device_key TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'scheduled',provider_id TEXT,error TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(intake_id,channel,device_key));
--> statement-breakpoint
CREATE TABLE lead_intake_lock (id INTEGER PRIMARY KEY CHECK(id=1),owner TEXT NOT NULL,expires_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TRIGGER lead_intake_index_insert AFTER INSERT ON lead_intakes WHEN NEW.contact_id IS NOT NULL BEGIN INSERT INTO claus_ai_index_queue(source_key,source_kind,source_id,status) VALUES ('lead:'||NEW.id,'lead',NEW.id,'pending') ON CONFLICT(source_key) DO UPDATE SET status='pending'; END;
--> statement-breakpoint
CREATE TRIGGER lead_intake_index_update AFTER UPDATE OF contact_id,message,notes ON lead_intakes WHEN NEW.contact_id IS NOT NULL BEGIN INSERT INTO claus_ai_index_queue(source_key,source_kind,source_id,status) VALUES ('lead:'||NEW.id,'lead',NEW.id,'pending') ON CONFLICT(source_key) DO UPDATE SET status='pending'; END;
--> statement-breakpoint
CREATE TRIGGER lead_intake_index_delete AFTER DELETE ON lead_intakes BEGIN DELETE FROM claus_ai_index_queue WHERE source_key='lead:'||OLD.id; DELETE FROM claus_ai_embeddings WHERE source_kind='lead' AND source_id=OLD.id; END;
