import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

test('contact deletion removes linked lead deliveries and indexes without affecting other leads', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`PRAGMA foreign_keys=ON;
      CREATE TABLE contacts(id INTEGER PRIMARY KEY);
      CREATE TABLE campaign_templates(id INTEGER PRIMARY KEY);
      CREATE TABLE claus_ai_index_queue(source_key TEXT PRIMARY KEY,source_kind TEXT,source_id INTEGER,status TEXT);
      CREATE TABLE claus_ai_embeddings(source_kind TEXT,source_id INTEGER);
      INSERT INTO contacts VALUES(1),(2);`);
    db.exec(readFileSync(new URL('../drizzle/0034_lead_intake.sql', import.meta.url), 'utf8'));
    for (const id of [1, 2]) {
      db.prepare(`INSERT INTO lead_intakes(id,contact_id,provider,external_lead_id,source,subtype,received_at,raw_payload,metadata)
        VALUES(?,?,'website',?,'Website','Buyer',CURRENT_TIMESTAMP,'{}','{}')`).run(id,id,`lead-${id}`);
      db.prepare("INSERT INTO lead_notification_deliveries(intake_id,channel) VALUES(?,'email')").run(id);
      db.prepare("INSERT INTO claus_ai_embeddings VALUES('lead',?)").run(id);
    }
    assert.throws(() => db.prepare('DELETE FROM contacts WHERE id=?').run(1), /FOREIGN KEY/);
    const route = readFileSync(new URL('../app/api/crm/route.ts', import.meta.url), 'utf8');
    const cleanup = route.match(/db\.prepare\("(DELETE FROM lead_intakes WHERE contact_id=\?)"\)\.bind\(id\)/);
    assert.ok(cleanup, 'deleteContact must clean up linked intake records');
    assert.ok(route.indexOf(cleanup[0]) < route.indexOf('DELETE FROM contacts WHERE id=?'));
    db.exec('BEGIN');
    db.prepare(cleanup[1]).run(1);
    db.prepare('DELETE FROM contacts WHERE id=?').run(1);
    db.exec('COMMIT');
    for (const table of ['contacts','lead_intakes','lead_notification_deliveries','claus_ai_embeddings','claus_ai_index_queue']) {
      assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count, 1, table);
    }
    assert.equal(db.prepare('SELECT contact_id FROM lead_intakes').get().contact_id, 2);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { db.close(); }
});
