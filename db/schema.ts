import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
export const contacts = sqliteTable("contacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  preferredContact: text("preferred_contact"),
  relationship: text("relationship").notNull().default("Lead"),
  leadSource: text("lead_source"),
  leadSourceDetail: text("lead_source_detail"),
  campaign: text("campaign"),
  adLandingPage: text("ad_landing_page"),
  intent: text("intent").notNull().default("Unknown"),
  targetLocations: text("target_locations"),
  priceRange: text("price_range"),
  financingType: text("financing_type"),
  preApproved: integer("pre_approved", { mode: "boolean" }),
  desiredProperty: text("desired_property"),
  desiredMoveDate: text("desired_move_date"),
  propertyAddress: text("property_address"),
  sellingTimeline: text("selling_timeline"),
  sellingReason: text("selling_reason"),
  propertyStatus: text("property_status"),
  relationshipSummary: text("relationship_summary"),
  motivation: text("motivation"),
  concerns: text("concerns"),
  objections: text("objections"),
  contextualNotes: text("contextual_notes"),
  estimatedTimeline: text("estimated_timeline"),
  temperature: text("temperature").notNull().default("Warm"),
  lastMeaningfulContact: text("last_meaningful_contact"),
  nextFollowUp: text("next_follow_up"),
  recommendedNextAction: text("recommended_next_action"),
  lastAiSummaryAt: text("last_ai_summary_at"),
  tags: text("tags"),
  isSample: integer("is_sample", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
});
export const opportunities = sqliteTable(
  "opportunities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id),
    type: text("type").notNull(),
    stage: text("stage").notNull(),
    estimatedPrice: real("estimated_price"),
    estimatedCommission: real("estimated_commission"),
    probability: integer("probability"),
    expectedTimeframe: text("expected_timeframe"),
    propertyAddress: text("property_address"),
    notes: text("notes"),
    isSample: integer("is_sample", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
    updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (t) => [
    index("idx_opportunities_contact_id").on(t.contactId),
    index("idx_opportunities_stage").on(t.stage),
  ],
);
export const tasks = sqliteTable(
  "tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    contactId: integer("contact_id").references(() => contacts.id),
    opportunityId: integer("opportunity_id").references(() => opportunities.id),
    title: text("title").notNull(),
    type: text("type").notNull().default("Task"),
    dueDate: text("due_date").notNull(),
    dueTime: text("due_time"),
    priority: text("priority").notNull().default("Normal"),
    status: text("status").notNull().default("Open"),
    notes: text("notes"),
    isSample: integer("is_sample", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
    completedAt: text("completed_at"),
  },
  (t) => [
    index("idx_tasks_status_due_date").on(t.status, t.dueDate),
    index("idx_tasks_contact_id").on(t.contactId),
  ],
);
export const notes = sqliteTable(
  "notes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id),
    body: text("body").notNull(),
    isSample: integer("is_sample", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (t) => [index("idx_notes_contact_created").on(t.contactId, t.createdAt)],
);
export const communications = sqliteTable(
  "communications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    contactId: integer("contact_id").references(() => contacts.id),
    type: text("type").notNull(),
    direction: text("direction").notNull(),
    occurredAt: text("occurred_at").notNull(),
    subject: text("subject"),
    messageTranscript: text("message_transcript"),
    durationSeconds: integer("duration_seconds"),
    recordingUrl: text("recording_url"),
    recordingId: text("recording_id"),
    aiSummary: text("ai_summary"),
    callOutcome: text("call_outcome"),
    followUpSuggestion: text("follow_up_suggestion"),
    externalProviderId: text("external_provider_id").unique(),
    fromNumber: text("from_number"),
    toNumber: text("to_number"),
    callerNumber: text("caller_number"),
    destinationNumber: text("destination_number"),
    bradCellNumber: text("brad_cell_number"),
    businessNumber: text("business_number"),
    callControlId: text("call_control_id"),
    callLegId: text("call_leg_id"),
    relatedCallLegIds: text("related_call_leg_ids"),
    startedAt: text("started_at"),
    answeredAt: text("answered_at"),
    bridgedAt: text("bridged_at"),
    endedAt: text("ended_at"),
    status: text("status"),
    isSample: integer("is_sample", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => [
    index("idx_communications_contact_id").on(t.contactId),
    index("idx_communications_call_control_id").on(t.callControlId),
  ],
);
export const properties = sqliteTable("properties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  contactId: integer("contact_id")
    .notNull()
    .references(() => contacts.id),
  address: text("address").notNull(),
  relationship: text("relationship"),
  status: text("status"),
  notes: text("notes"),
  isSample: integer("is_sample", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});
export const activities = sqliteTable(
  "activities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id),
    type: text("type").notNull(),
    title: text("title").notNull(),
    detail: text("detail"),
    occurredAt: text("occurred_at").notNull().default("CURRENT_TIMESTAMP"),
    sourceId: integer("source_id"),
    isSample: integer("is_sample", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => [
    index("idx_activities_contact_occurred").on(t.contactId, t.occurredAt),
  ],
);
export const telnyxEvents = sqliteTable(
  "telnyx_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventId: text("event_id").notNull().unique(),
    eventType: text("event_type").notNull(),
    callControlId: text("call_control_id"),
    callLegId: text("call_leg_id"),
    callSessionId: text("call_session_id"),
    fromNumber: text("from_number"),
    toNumber: text("to_number"),
    direction: text("direction"),
    payload: text("payload").notNull(),
    receivedAt: text("received_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("idx_telnyx_events_received_at").on(t.receivedAt),
    index("idx_telnyx_events_type_received").on(t.eventType, t.receivedAt),
  ],
);
export const webrtcPresence = sqliteTable("webrtc_presence", {
  id: text("id").primaryKey(),
  lastSeen: text("last_seen")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  connected: integer("connected", { mode: "boolean" }).notNull().default(false),
});
export const telnyxWebrtcCredentials = sqliteTable(
  "telnyx_webrtc_credentials",
  {
    identity: text("identity").primaryKey(),
    credentialId: text("credential_id").notNull().unique(),
    sipUsername: text("sip_username").notNull(),
    expiresAt: text("expires_at"),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
);
export const telnyxCallFlows = sqliteTable(
  "telnyx_call_flows",
  {
    id: text("id").primaryKey(),
    communicationId: integer("communication_id")
      .notNull()
      .references(() => communications.id),
    direction: text("direction").notNull(),
    contactId: integer("contact_id").references(() => contacts.id),
    contactNumber: text("contact_number"),
    callSessionId: text("call_session_id").unique(),
    primaryCallControlId: text("primary_call_control_id"),
    bradCallControlId: text("brad_call_control_id"),
    contactCallControlId: text("contact_call_control_id"),
    connectionId: text("connection_id").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("idx_telnyx_call_flows_communication").on(t.communicationId),
    index("idx_telnyx_call_flows_session").on(t.callSessionId),
  ],
);
