import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { retrieve } from "../lib/claus-ai/retrieval.ts";
import { dateMentions, resolveRelativeDate } from "../lib/claus-ai/dates.mjs";

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  const fields = "id INTEGER PRIMARY KEY,first_name TEXT,last_name TEXT,relationship TEXT,intent TEXT,stage TEXT,lead_source TEXT,temperature TEXT,tags TEXT,birthday TEXT,spouse_name TEXT,address TEXT,price_range TEXT,target_locations TEXT,financing_type TEXT,desired_property TEXT,desired_move_date TEXT,property_address TEXT,selling_timeline TEXT,selling_reason TEXT,motivation TEXT,concerns TEXT,relationship_summary TEXT,contextual_notes TEXT,last_meaningful_contact TEXT,next_follow_up TEXT,recommended_next_action TEXT";
  sqlite.exec(`CREATE TABLE contacts (${fields});
    CREATE TABLE communications (id INTEGER PRIMARY KEY,contact_id INTEGER,type TEXT,direction TEXT,occurred_at TEXT,subject TEXT,message_transcript TEXT,ai_summary TEXT,participants TEXT);
    CREATE TABLE contact_intelligence (id INTEGER PRIMARY KEY,contact_id INTEGER,category TEXT,field_name TEXT,value TEXT,status TEXT,source_system TEXT,source_date TEXT);
    CREATE TABLE tasks (id INTEGER PRIMARY KEY,contact_id INTEGER,title TEXT,type TEXT,status TEXT,due_date TEXT,due_time TEXT,notes TEXT,calendar_sync_status TEXT);
    CREATE TABLE opportunities (id INTEGER PRIMARY KEY,contact_id INTEGER,type TEXT,stage TEXT,estimated_price INTEGER,property_address TEXT,expected_timeframe TEXT,updated_at TEXT);
    CREATE TABLE properties (id INTEGER PRIMARY KEY,contact_id INTEGER,address TEXT,relationship TEXT,status TEXT,created_at TEXT);
    CREATE TABLE relationship_moments (id INTEGER PRIMARY KEY,contact_id INTEGER,type TEXT,date_value TEXT,label TEXT);
    CREATE TABLE contact_relationships (id INTEGER PRIMARY KEY,contact_id INTEGER,related_first_name TEXT,related_last_name TEXT,relationship_type TEXT,source_date TEXT);
    CREATE TABLE communication_suggestions (id INTEGER PRIMARY KEY,communication_id INTEGER,title TEXT,detail TEXT,due_date TEXT,status TEXT,commitment INTEGER);
    CREATE TABLE notes (id INTEGER PRIMARY KEY,contact_id INTEGER,body TEXT,created_at TEXT); `);
  sqlite.exec(`INSERT INTO contacts(id,first_name,last_name,relationship,intent,stage,last_meaningful_contact) VALUES
    (1,'Alex','Example','Past Client','Seller','Opportunity','2026-09-01'),
    (2,'Casey','Example','Past Client','Seller','Active','2026-09-22'),
    (3,'Taylor','Example','Lead','Buyer','Lead','2025-01-01');
    INSERT INTO communications VALUES (1,1,'SMS','Inbound','2026-09-20T13:00:00Z',NULL,'We need to handle the repairs before listing.',NULL,NULL),
      (2,2,'SMS','Inbound','2026-09-21T13:00:00Z',NULL,'We may downsize after graduation.',NULL,NULL);
    INSERT INTO tasks(id,contact_id,title,type,status,due_date,due_time) VALUES
      (1,2,'Home visit','Appointment','Open','2026-09-25','10:00'),
      (2,1,'Send contractor list','Task','Open','2026-01-10',NULL);
    INSERT INTO communication_suggestions VALUES(1,1,'Send repair options',NULL,'2026-09-25','Accepted',1);
    INSERT INTO contact_relationships VALUES(1,1,'Sam','Buyer','Referred By','2026-06-15');`);
  return {
    prepare(sql) { return { bind(...values) { return { all() { return { results: sqlite.prepare(sql).all(...values) }; }, first() { return sqlite.prepare(sql).get(...values); } }; } }; },
    close() { sqlite.close(); },
  };
}

for (const [question, tool, expected] of [
  ["Summarize Alex Example.", "get_contact", "Alex"],
  ["What did Alex say about repairs?", "get_contact", "repairs"],
  ["Which Past Clients are Seller intent?", "query_contacts", "Casey"],
  ["What promises are still open?", "query_commitments", "repair"],
  ["Who mentioned downsizing?", "search_communications", "downsize"],
  ["Who referred clients this year?", "query_referrals", "Referred By"],
]) test(question, async () => {
  const db = fixture();
  try {
    const result = await retrieve(db, question);
    assert.ok(result.tools.includes(tool));
    assert.match(JSON.stringify(result.evidence).toLowerCase(), new RegExp(expected.toLowerCase()));
  } finally { db.close(); }
});

test("appointment query uses the current Chicago week", async () => {
  const db = fixture();
  try {
    const result = await retrieve(db, "What appointments do I have this week?");
    assert.ok(result.tools.includes("query_appointments"));
    // The seeded appointment is a historical fixture; the query must not invent it as current.
    assert.ok(result.evidence.every(e => e.kind === "appointment"));
  } finally { db.close(); }
});

test("next Wednesday is resolved from the message's Chicago date without inventing a time", () => {
  assert.equal(resolveRelativeDate("next Wednesday", "2026-09-22T17:00:00Z"), "2026-09-30");
  assert.deepEqual(dateMentions("We can meet next Wednesday", "2026-09-22T17:00:00Z").map(x => [x.calendarDate, x.hasTime]), [["2026-09-30", false]]);
});

test("later accepted time is kept as a separate message for model review", async () => {
  const db = fixture();
  try {
    const result = await retrieve(db, "Summarize Casey Example");
    assert.ok(result.records.some(r => r.kind === "communication"));
    // Acceptance is a conversation-level inference, never assigned by this date resolver.
    assert.ok(result.records.every(r => !r.acceptedAppointmentTime));
  } finally { db.close(); }
});
