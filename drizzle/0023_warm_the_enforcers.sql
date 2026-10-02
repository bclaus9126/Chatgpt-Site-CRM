ALTER TABLE `communication_suggestions` ADD `original_value` text;--> statement-breakpoint
ALTER TABLE `communication_suggestions` ADD `edited_by` text;--> statement-breakpoint
ALTER TABLE `communication_suggestions` ADD `edited_at` text;--> statement-breakpoint
ALTER TABLE `communication_suggestions` ADD `dismissal_reason` text;--> statement-breakpoint
CREATE TRIGGER `review_supersede_pending_fact` BEFORE INSERT ON `communication_suggestions`
WHEN NEW.field_name IS NOT NULL AND NEW.field_name <> '' AND NEW.status = 'Suggested'
BEGIN
  UPDATE communication_suggestions SET status='Superseded'
  WHERE status='Suggested' AND field_name=NEW.field_name
    AND communication_id IN (
      SELECT old.id FROM communications old JOIN communications incoming ON incoming.id=NEW.communication_id
      WHERE old.contact_id=incoming.contact_id AND old.contact_id IS NOT NULL
        AND old.occurred_at<=incoming.occurred_at
    );
END;
