import {
  index,
  uniqueIndex,
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
  displayName: text("display_name"),
  additionalPhones: text("additional_phones"),
  phoneType: text("phone_type"),
  additionalEmails: text("additional_emails"),
  emailType: text("email_type"),
  spouseName: text("spouse_name"),
  updatedBy: text("updated_by"),
  updateSource: text("update_source"),
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
  externalFubId: text("external_fub_id"),
  sourceSystem: text("source_system"),
  importJobId: integer("import_job_id"),
  birthday: text("birthday"),
  dateAdded: text("date_added"),
  stage: text("stage"),
  timeframe: text("timeframe"),
  isSample: integer("is_sample", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const importJobs = sqliteTable(
  "import_jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    fileName: text("file_name").notNull(),
    sourceSystem: text("source_system").notNull(),
    totalRows: integer("total_rows").notNull().default(0),
    importedRecords: integer("imported_records").notNull().default(0),
    updatedRecords: integer("updated_records").notNull().default(0),
    skippedRecords: integer("skipped_records").notNull().default(0),
    duplicateRecords: integer("duplicate_records").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    warningCount: integer("warning_count").notNull().default(0),
    status: text("status").notNull().default("Processing"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    completedAt: text("completed_at"),
    rolledBackAt: text("rolled_back_at"),
  },
  (t) => [index("idx_import_jobs_created_at").on(t.createdAt)],
);

export const importRows = sqliteTable(
  "import_rows",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    importJobId: integer("import_job_id").notNull().references(() => importJobs.id),
    rowNumber: integer("row_number").notNull(),
    externalFubId: text("external_fub_id"),
    contactId: integer("contact_id").references(() => contacts.id),
    status: text("status").notNull(),
    matchType: text("match_type"),
    warning: text("warning"),
    error: text("error"),
    rawJson: text("raw_json").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("idx_import_rows_job").on(t.importJobId),
    index("idx_import_rows_external_fub").on(t.externalFubId),
  ],
);

export const contactMethods = sqliteTable(
  "contact_methods",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    contactId: integer("contact_id").notNull().references(() => contacts.id),
    importJobId: integer("import_job_id").references(() => importJobs.id),
    kind: text("kind").notNull(),
    value: text("value").notNull(),
    normalizedValue: text("normalized_value"),
    label: text("label"),
    sourceSystem: text("source_system"),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("idx_contact_methods_contact").on(t.contactId)],
);

export const contactRelationships = sqliteTable(
  "contact_relationships",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    contactId: integer("contact_id").notNull().references(() => contacts.id),
    relatedContactId: integer("related_contact_id").references(() => contacts.id),
    importJobId: integer("import_job_id").references(() => importJobs.id),
    relationshipType: text("relationship_type").notNull(),
    relatedFirstName: text("related_first_name"),
    relatedLastName: text("related_last_name"),
    sourceSystem: text("source_system"),
    sourceField: text("source_field"),
    sourceDate: text("source_date"),
  },
  (t) => [index("idx_contact_relationships_contact").on(t.contactId)],
);

export const contactIntelligence = sqliteTable(
  "contact_intelligence",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    contactId: integer("contact_id").notNull().references(() => contacts.id),
    importJobId: integer("import_job_id").references(() => importJobs.id),
    category: text("category").notNull(),
    fieldName: text("field_name").notNull(),
    value: text("value").notNull(),
    status: text("status").notNull().default("Current"),
    sourceSystem: text("source_system").notNull(),
    sourceRecordId: text("source_record_id"),
    sourceField: text("source_field"),
    sourceDate: text("source_date"),
    confidence: real("confidence").notNull().default(1),
    supersededAt: text("superseded_at"),
  },
  (t) => [index("idx_contact_intelligence_contact").on(t.contactId)],
);

export const relationshipMoments = sqliteTable(
  "relationship_moments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    contactId: integer("contact_id").notNull().references(() => contacts.id),
    importJobId: integer("import_job_id").references(() => importJobs.id),
    type: text("type").notNull(),
    dateValue: text("date_value").notNull(),
    label: text("label").notNull(),
    sourceSystem: text("source_system").notNull(),
    sourceRecordId: text("source_record_id"),
  },
  (t) => [index("idx_relationship_moments_contact").on(t.contactId)],
);
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
    details: text("details"),
    updatedBy: text("updated_by"),
    updateSource: text("update_source"),
    importJobId: integer("import_job_id").references(() => importJobs.id),
    sourceSystem: text("source_system"),
    sourceRecordId: text("source_record_id"),
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
    dueDate: text("due_date"),
    dueTime: text("due_time"),
    priority: text("priority").notNull().default("Normal"),
    status: text("status").notNull().default("Open"),
    notes: text("notes"),
    details: text("details"),
    updatedAt: text("updated_at"),
    updatedBy: text("updated_by"),
    updateSource: text("update_source"),
    sourceSystem: text("source_system"),
    sourceRecordId: text("source_record_id"),
    aiExtracted: integer("ai_extracted", { mode: "boolean" }).notNull().default(false),
    isSample: integer("is_sample", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
    completedAt: text("completed_at"),
    microsoftEventId: text("microsoft_event_id"),
    microsoftCalendarId: text("microsoft_calendar_id"),
    calendarSyncStatus: text("calendar_sync_status"),
    calendarSyncError: text("calendar_sync_error"),
    lastCalendarSyncAt: text("last_calendar_sync_at"),
    calendarTransactionId: text("calendar_transaction_id"),
    calendarChangeKey: text("calendar_change_key"),
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
    importJobId: integer("import_job_id").references(() => importJobs.id),
    sourceSystem: text("source_system"),
    sourceRecordId: text("source_record_id"),
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
    importJobId: integer("import_job_id").references(() => importJobs.id),
    sourceSystem: text("source_system"),
    sourceRecordId: text("source_record_id"),
    participants: text("participants"),
    imported: integer("imported", { mode: "boolean" }).notNull().default(false),
    originalImportedText: text("original_imported_text"),
    audioObjectKey: text("audio_object_key"),
    audioContentType: text("audio_content_type"),
    interactionType: text("interaction_type"),
    authorName: text("author_name"),
    transcriptionStatus: text("transcription_status"),
    transcriptTimestamps: text("transcript_timestamps"),
    analysisStatus: text("analysis_status"),
    isSample: integer("is_sample", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => [
    index("idx_communications_contact_id").on(t.contactId),
    index("idx_communications_call_control_id").on(t.callControlId),
  ],
);
export const communicationSuggestions = sqliteTable(
  "communication_suggestions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    communicationId: integer("communication_id")
      .notNull()
      .references(() => communications.id),
    category: text("category").notNull(),
    title: text("title").notNull(),
    detail: text("detail"),
    dueDate: text("due_date"),
    dueTime: text("due_time"),
    daypart: text("daypart"),
    schedulingPrecision: text("scheduling_precision"),
    fieldName: text("field_name"),
    fieldValue: text("field_value"),
    status: text("status").notNull().default("Suggested"),
    commitment: integer("commitment", { mode: "boolean" }).notNull().default(false),
    sourceExcerpt: text("source_excerpt"),
    needsReview: integer("needs_review", { mode: "boolean" }).notNull().default(false),
    aiExtracted: integer("ai_extracted", { mode: "boolean" }).notNull().default(true),
    acceptedBy: text("accepted_by"),
    acceptedAt: text("accepted_at"),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (t) => [index("idx_suggestions_communication").on(t.communicationId)],
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
  importJobId: integer("import_job_id").references(() => importJobs.id),
  sourceSystem: text("source_system"),
  externalRecordId: text("external_record_id"),
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

export const clausAiTurns = sqliteTable("claus_ai_turns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id"),
  conversationId: text("conversation_id").notNull(),
  question: text("question").notNull(),
  answer: text("answer"),
  tools: text("tools"),
  evidence: text("evidence"),
  provider: text("provider"),
  model: text("model"),
  usage: text("usage"),
  elapsedMs: integer("elapsed_ms"),
  error: text("error"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("idx_ai_turns_conversation").on(t.conversationId, t.id)]);

export const clausAiDrafts = sqliteTable("claus_ai_drafts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  turnId: integer("turn_id").references(() => clausAiTurns.id),
  contactId: integer("contact_id").notNull().references(() => contacts.id),
  communicationId: integer("communication_id").notNull().references(() => communications.id),
  medium: text("medium").notNull(),
  generatedDraft: text("generated_draft").notNull(),
  factsUsed: text("facts_used"),
  openQuestions: text("open_questions"),
  riskFlags: text("risk_flags"),
  status: text("status").notNull().default("Suggested"),
  finalVersion: text("final_version"),
  reviewedAt: text("reviewed_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("idx_ai_drafts_communication").on(t.communicationId)]);

export const clausAiEmbeddings = sqliteTable("claus_ai_embeddings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceKind: text("source_kind").notNull(),
  sourceId: integer("source_id").notNull(),
  contactId: integer("contact_id"),
  occurredAt: text("occurred_at"),
  contentHash: text("content_hash").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  vectorJson: text("vector_json").notNull(),
}, (t) => [uniqueIndex("idx_ai_embedding_source_model").on(t.sourceKind, t.sourceId, t.provider, t.model)]);
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

export const microsoftMailConnections = sqliteTable("microsoft_mail_connections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerUserId: text("owner_user_id").notNull(),
  mailbox: text("mailbox").notNull(),
  graphUserId: text("graph_user_id").notNull(),
  encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
  sendEnabled: integer("send_enabled").notNull().default(0),
  calendarEnabled: integer("calendar_enabled").notNull().default(0),
  subscriptionId: text("subscription_id"),
  clientState: text("client_state"),
  subscriptionExpiresAt: text("subscription_expires_at"),
  lastSyncedAt: text("last_synced_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, t => [uniqueIndex("idx_microsoft_mail_connections_mailbox").on(t.mailbox)]);

export const microsoftOauthStates = sqliteTable("microsoft_oauth_states", {
  state: text("state").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  verifier: text("verifier").notNull(),
  expiresAt: text("expires_at").notNull(),
});
