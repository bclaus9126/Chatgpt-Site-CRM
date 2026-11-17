# Lead intake and owner notifications

All adapters share `intakeLead`. Manual contact creation and FUB imports do not call it. Live webhook inquiries create a lead-intake history record, match/create a contact, create a Lead Received activity, queue SMS/email/push owner alerts, and optionally enroll a newly created eligible buyer in the explicitly configured active campaign. Existing-contact reactivation remains manual to avoid interrupting engaged clients. Duplicate provider+external ID calls repair missing notification claims without re-sending completed alerts.

## Website and generic setup

`POST https://claus-crm.bclaus.chatgpt.site/api/leads/inbound?provider=website`

Generic: same endpoint with `provider=generic`. Other adapters: `facebook`, `zillow`, `homes`, `email`.

Headers: `Content-Type: application/json`, `Authorization: Bearer <provider token>`.

Configure corresponding server secret `LEAD_INTAKE_WEBSITE_TOKEN`, `LEAD_INTAKE_GENERIC_TOKEN`, etc. Use at least 32 random characters. Keep tokens on the provider/website backend, never browser forms. Enable the provider in Settings → Lead Sources / Integrations. Tokens are not included in this repository.

```json
{"external_lead_id":"stable-provider-submission-id","name":"Example Buyer","email":"buyer@example.com","phone":"+12105550110","intent":"Buyer","message":"Please contact me about this home","property_address":"100 Example St","received_at":"2026-10-12T20:00:00Z","source_campaign":"Website registration","source_metadata":{"utm_source":"example"},"sms_consent":true,"email_consent":true}
```

201 = new intake; 200 = duplicate; 401 = invalid auth; 403 = inactive; 400 = invalid payload; 503 = integration unavailable/busy. Retry transient failures with the same external ID. Maximum payload 100 KB. Unknown fields remain in sanitized raw payload; secret-like keys are redacted.

## Providers

- Website: authenticated server submission ready; change the website's FUB destination only after a live test.
- Facebook: accepts fully hydrated `field_data` lead details from an authenticated connector. Native Meta challenge/signature callbacks and Graph lead retrieval are NOT configured.
- Zillow / Homes.com: authenticated forwarded payload adapters available. Native approved provider API access is NOT configured. A provider or forwarding connector must be configured externally.
- Email: owner-only `POST /api/leads/email`, using existing Microsoft mailbox. Configure `LEAD_EMAIL_RULES` as JSON: `[{"provider":"zillow","from":"exact-approved-sender@example.com","subject":"specific lead subject"}]`. Reads newest 50 inbox emails within 24 hours, only exact allowlisted senders and subject phrases. Requires labeled Name/Email/Phone/Property/Message content; actual provider samples must be validated. No AI parsing. Recurring mailbox ingestion remains a setup item.

## Delivery

Email uses the connected owner Microsoft mailbox with Mail.Send and goes ONLY to CRM_OWNER_EMAIL. Text uses the primary Telnyx business number and goes ONLY to BRAD_CELL. Push goes to registered subscriptions of the connected owner. Owner notifications are stored in `lead_notification_deliveries`, never client communications. Notification sends run asynchronously after intake persistence, ahead of AI/indexing. The existing secure campaign scheduler also drains scheduled notification jobs even if automatic campaign sending is off. Unknown delivery outcomes are not automatically retried; explicit failed deliveries can be retried after fixing their configuration. Settings exposes status and errors without endpoints/tokens. Provider acceptance is not proof of handset delivery.

Test Lead validates adapters with a marked intake record but creates no contact/campaign/notifications. The separate owner notification test sends a clearly marked alert to Brad only. Tests can be deleted safely from Settings.

## Storage and cutover

Migration 0034 adds lead_intakes, lead_sources, lead_notification_deliveries, and a short intake-processing lock; preserves existing contacts/history. The original contact lead_source is only filled when empty. Latest source and original/ongoing inquiries remain queryable through intake history. Conflicting identity matches require owner review. Appointment and response metrics denote later CRM activity, not proven attribution.

Lead Cards appear on Today for the last seven days and on each contact. Settings includes provider activation, campaign mapping, destination, last received/error, matching review, notification logs, tests, and FUB cutover checkboxes. A provider cannot be marked live-tested until a production intake was processed. Disable unused sources intentionally. Do not cancel FUB until every actual provider has a successful live test or is intentionally disabled.

Claus AI can query source/provider/intake records deterministically. Narrative inquiry messages, notes, and long form answers enter the existing index queue with lead metadata. Short scalar answers remain structured; no property preference is inferred from a clicked listing.
