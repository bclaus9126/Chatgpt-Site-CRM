UPDATE lead_sources SET campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) WHERE provider='facebook';
