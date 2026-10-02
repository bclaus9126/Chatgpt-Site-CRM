CREATE TABLE `buyer_profiles` (
	`contact_id` integer PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`legacy_values` text,
	`price_min` real,
	`price_max` real,
	`price_ceiling` real,
	`bedrooms_needed` real,
	`bathrooms_needed` real,
	`minimum_square_footage` real,
	`target_areas_zip_codes` text,
	`specific_neighborhoods` text,
	`specific_schools` text,
	`school_district` text,
	`maximum_commute_time` real,
	`garage_size_needed` real,
	`lot_size_preference` text,
	`one_story_preference` integer,
	`new_construction_preference` integer,
	`property_type_preference` text,
	`must_haves` text,
	`nice_to_haves` text,
	`deal_breakers` text,
	`pre_approval_status` text,
	`pre_approval_amount` real,
	`lender_contact` text,
	`loan_type` text,
	`down_payment` real,
	`monthly_payment_target` real,
	`relocating_from` text,
	`lease_end_date` text,
	`target_move_in_date` text,
	`purchase_timeline` text,
	`need_to_sell_existing_home_first` integer,
	`existing_home_address` text,
	`household_members` text,
	`pets` text,
	`household_notes` text,
	`first_contact_date` text,
	`last_showing_date` text,
	`showings_to_date` real,
	`offers_written` real,
	`offers_accepted` real,
	`homes_loved_and_lost` text,
	`buyer_activity_notes` text,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `real_estate_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer NOT NULL,
	`contact_id` integer NOT NULL,
	`transaction_id` integer,
	`field_name` text NOT NULL,
	`old_value` text,
	`new_value` text,
	`changed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`changed_by` text NOT NULL,
	`source` text NOT NULL,
	`source_record_id` text,
	`source_date` text,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_re_history_entity` ON `real_estate_history` (`entity_type`,`entity_id`,`id`);--> statement-breakpoint
CREATE TABLE `transaction_contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transaction_id` integer NOT NULL,
	`contact_id` integer NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tx_contact_link` ON `transaction_contacts` (`transaction_id`,`contact_id`);--> statement-breakpoint
CREATE TABLE `transaction_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transaction_id` integer NOT NULL,
	`name` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text,
	`size` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `transaction_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transaction_id` integer NOT NULL,
	`kind` text NOT NULL,
	`record_id` integer NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tx_record_link` ON `transaction_links` (`transaction_id`,`kind`,`record_id`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contact_id` integer NOT NULL,
	`property_id` integer,
	`legacy_opportunity_id` integer,
	`side` text NOT NULL,
	`status` text DEFAULT 'Preparing' NOT NULL,
	`property_address` text,
	`lead_source` text,
	`agent` text,
	`source_system` text,
	`source_record_id` text,
	`legacy_values` text,
	`closetraq_transaction_id` text,
	`closetraq_sync_status` text,
	`closetraq_last_synced_at` text,
	`closetraq_sync_error` text,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`price_expectation` real,
	`original_list_price` real,
	`current_price` real,
	`contract_price` real,
	`sold_price` real,
	`mortgage_balance` real,
	`estimated_equity` real,
	`seller_concessions` real,
	`buyer_concessions` real,
	`estimated_net_proceeds` real,
	`final_net_proceeds` real,
	`price_per_square_foot` real,
	`listing_appointment_date` text,
	`listing_agreement_signed_date` text,
	`photos_scheduled_date` text,
	`photos_completed_date` text,
	`repairs_expected_complete_date` text,
	`listing_live_date` text,
	`original_list_date` text,
	`contract_date` text,
	`mutual_acceptance_date` text,
	`earnest_money_due` text,
	`option_deadline` text,
	`finance_approval_deadline` text,
	`title_documents_deadline` text,
	`survey_deadline` text,
	`hoa_documents_deadline` text,
	`final_walk_through` text,
	`close_date` text,
	`possession_date` text,
	`days_on_market` real,
	`number_of_showings` real,
	`number_of_open_houses` real,
	`number_of_offers` real,
	`number_of_price_reductions` real,
	`last_showing_date` text,
	`showing_feedback` text,
	`offer_history` text,
	`open_house_history` text,
	`listing_activity_notes` text,
	`seller_concerns` text,
	`motivations` text,
	`repair_notes` text,
	`negotiation_notes` text,
	`transaction_summary` text,
	`timeline_narrative` text,
	`listing_agent` text,
	`other_agent` text,
	`buyer_agent` text,
	`lender` text,
	`title_company` text,
	`commission` real,
	`agent_split` real,
	`team_split` real,
	`mls_link` text,
	`virtual_tour_link` text,
	`photos_link` text,
	`other_links` text,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_legacy_opportunity_id_unique` ON `transactions` (`legacy_opportunity_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_contact` ON `transactions` (`contact_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_side_status` ON `transactions` (`side`,`status`);--> statement-breakpoint
ALTER TABLE `claus_ai_embeddings` ADD `metadata_json` text;--> statement-breakpoint
ALTER TABLE `properties` ADD `street` text;--> statement-breakpoint
ALTER TABLE `properties` ADD `city` text;--> statement-breakpoint
ALTER TABLE `properties` ADD `state` text;--> statement-breakpoint
ALTER TABLE `properties` ADD `zip` text;--> statement-breakpoint
ALTER TABLE `properties` ADD `mls_number` text;--> statement-breakpoint
ALTER TABLE `properties` ADD `property_type` text;--> statement-breakpoint
ALTER TABLE `properties` ADD `subdivision` text;--> statement-breakpoint
ALTER TABLE `properties` ADD `bedrooms` real;--> statement-breakpoint
ALTER TABLE `properties` ADD `bathrooms` real;--> statement-breakpoint
ALTER TABLE `properties` ADD `square_footage` real;--> statement-breakpoint
ALTER TABLE `properties` ADD `lot_size` text;--> statement-breakpoint
ALTER TABLE `properties` ADD `year_built` real;--> statement-breakpoint
ALTER TABLE `properties` ADD `builder_name` text;--> statement-breakpoint
ALTER TABLE `properties` ADD `garage_size` real;--> statement-breakpoint
ALTER TABLE `properties` ADD `hoa_name` text;--> statement-breakpoint
ALTER TABLE `properties` ADD `hoa_amount` real;--> statement-breakpoint
ALTER TABLE `properties` ADD `occupancy_status` text;--> statement-breakpoint
ALTER TABLE `properties` ADD `warranty_provider` text;--> statement-breakpoint
ALTER TABLE `properties` ADD `key_features` text;--> statement-breakpoint
ALTER TABLE `properties` ADD `description` text;--> statement-breakpoint
ALTER TABLE `properties` ADD `updated_at` text;--> statement-breakpoint
ALTER TABLE `properties` ADD `revision` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TRIGGER ai_transactions_insert AFTER INSERT ON transactions BEGIN DELETE FROM claus_ai_embeddings WHERE source_kind='transaction' AND source_id=NEW.id; INSERT INTO claus_ai_index_queue(source_kind,source_id,source_key) VALUES('transaction',NEW.id,'transaction:'||NEW.id) ON CONFLICT(source_key) DO UPDATE SET status='pending',error=NULL,updated_at=CURRENT_TIMESTAMP; END;
--> statement-breakpoint
CREATE TRIGGER ai_transactions_update AFTER UPDATE ON transactions BEGIN DELETE FROM claus_ai_embeddings WHERE source_kind='transaction' AND source_id=NEW.id; INSERT INTO claus_ai_index_queue(source_kind,source_id,source_key) VALUES('transaction',NEW.id,'transaction:'||NEW.id) ON CONFLICT(source_key) DO UPDATE SET status='pending',error=NULL,updated_at=CURRENT_TIMESTAMP; END;
--> statement-breakpoint
CREATE TRIGGER ai_transactions_delete AFTER DELETE ON transactions BEGIN DELETE FROM claus_ai_embeddings WHERE source_kind='transaction' AND source_id=OLD.id; DELETE FROM claus_ai_index_queue WHERE source_key='transaction:'||OLD.id; END;
--> statement-breakpoint
CREATE TRIGGER ai_properties_insert AFTER INSERT ON properties BEGIN DELETE FROM claus_ai_embeddings WHERE source_kind='property' AND source_id=NEW.id; INSERT INTO claus_ai_index_queue(source_kind,source_id,source_key) VALUES('property',NEW.id,'property:'||NEW.id) ON CONFLICT(source_key) DO UPDATE SET status='pending',error=NULL,updated_at=CURRENT_TIMESTAMP; END;
--> statement-breakpoint
CREATE TRIGGER ai_properties_update AFTER UPDATE ON properties BEGIN DELETE FROM claus_ai_embeddings WHERE source_kind='property' AND source_id=NEW.id; INSERT INTO claus_ai_index_queue(source_kind,source_id,source_key) VALUES('property',NEW.id,'property:'||NEW.id) ON CONFLICT(source_key) DO UPDATE SET status='pending',error=NULL,updated_at=CURRENT_TIMESTAMP; END;
--> statement-breakpoint
CREATE TRIGGER ai_properties_delete AFTER DELETE ON properties BEGIN DELETE FROM claus_ai_embeddings WHERE source_kind='property' AND source_id=OLD.id; DELETE FROM claus_ai_index_queue WHERE source_key='property:'||OLD.id; END;
--> statement-breakpoint
CREATE TRIGGER ai_buyer_profiles_insert AFTER INSERT ON buyer_profiles BEGIN DELETE FROM claus_ai_embeddings WHERE source_kind='buyer_profile' AND source_id=NEW.contact_id; INSERT INTO claus_ai_index_queue(source_kind,source_id,source_key) VALUES('buyer_profile',NEW.contact_id,'buyer_profile:'||NEW.contact_id) ON CONFLICT(source_key) DO UPDATE SET status='pending',error=NULL,updated_at=CURRENT_TIMESTAMP; END;
--> statement-breakpoint
CREATE TRIGGER ai_buyer_profiles_update AFTER UPDATE ON buyer_profiles BEGIN DELETE FROM claus_ai_embeddings WHERE source_kind='buyer_profile' AND source_id=NEW.contact_id; INSERT INTO claus_ai_index_queue(source_kind,source_id,source_key) VALUES('buyer_profile',NEW.contact_id,'buyer_profile:'||NEW.contact_id) ON CONFLICT(source_key) DO UPDATE SET status='pending',error=NULL,updated_at=CURRENT_TIMESTAMP; END;
--> statement-breakpoint
CREATE TRIGGER ai_buyer_profiles_delete AFTER DELETE ON buyer_profiles BEGIN DELETE FROM claus_ai_embeddings WHERE source_kind='buyer_profile' AND source_id=OLD.contact_id; DELETE FROM claus_ai_index_queue WHERE source_key='buyer_profile:'||OLD.contact_id; END;
--> statement-breakpoint
CREATE TRIGGER ai_real_estate_history_insert AFTER INSERT ON real_estate_history BEGIN DELETE FROM claus_ai_embeddings WHERE source_kind='listing_history' AND source_id=NEW.id; INSERT INTO claus_ai_index_queue(source_kind,source_id,source_key) VALUES('listing_history',NEW.id,'listing_history:'||NEW.id) ON CONFLICT(source_key) DO UPDATE SET status='pending',error=NULL,updated_at=CURRENT_TIMESTAMP; END;
--> statement-breakpoint
CREATE TRIGGER ai_real_estate_history_update AFTER UPDATE ON real_estate_history BEGIN DELETE FROM claus_ai_embeddings WHERE source_kind='listing_history' AND source_id=NEW.id; INSERT INTO claus_ai_index_queue(source_kind,source_id,source_key) VALUES('listing_history',NEW.id,'listing_history:'||NEW.id) ON CONFLICT(source_key) DO UPDATE SET status='pending',error=NULL,updated_at=CURRENT_TIMESTAMP; END;
--> statement-breakpoint
CREATE TRIGGER ai_real_estate_history_delete AFTER DELETE ON real_estate_history BEGIN DELETE FROM claus_ai_embeddings WHERE source_kind='listing_history' AND source_id=OLD.id; DELETE FROM claus_ai_index_queue WHERE source_key='listing_history:'||OLD.id; END;
