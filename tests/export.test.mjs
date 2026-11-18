import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { isExportableTable, quoteTable, tableBatchSql, splitBatch, safeFilePath, buildReport, clampLimit } from '../lib/export/core.mjs';

// Runs the real batch query against an in-memory SQLite database,
// the same engine D1 uses.
function readAll(db, name, limit) {
  const rows = [];
  let after = 0;
  for (;;) {
    const results = db.prepare(tableBatchSql(name)).all(after, limit);
    const batch = splitBatch(results, limit);
    rows.push(...batch.rows);
    if (batch.next === null) return rows;
    after = batch.next;
  }
}

test('batching reads every row exactly once across batch edges', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)');
  for (let i = 1; i <= 1001; i++) db.prepare('INSERT INTO contacts(name) VALUES (?)').run(`Test ${i}`);
  db.exec('DELETE FROM contacts WHERE id IN (5, 200, 400)'); // gaps in ids
  for (const limit of [1, 7, 200, 1000, 5000]) {
    const rows = readAll(db, 'contacts', limit);
    assert.equal(rows.length, 998);
    assert.equal(new Set(rows.map((r) => r.id)).size, 998);
  }
});

test('batching works for tables with text primary keys', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE ai_settings (key TEXT PRIMARY KEY, value TEXT)');
  for (const k of ['b', 'a', 'c']) db.prepare('INSERT INTO ai_settings VALUES (?, ?)').run(k, 'x');
  const rows = readAll(db, 'ai_settings', 2);
  assert.deepEqual(rows.map((r) => r.key).sort(), ['a', 'b', 'c']);
  assert.ok(!('__export_rowid' in rows[0]), 'helper column is stripped');
});

test('rows added mid-export are picked up, not skipped', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT)');
  for (let i = 1; i <= 5; i++) db.prepare('INSERT INTO notes(body) VALUES (?)').run('n');
  const rows = [];
  let after = 0, batches = 0;
  for (;;) {
    const batch = splitBatch(db.prepare(tableBatchSql('notes')).all(after, 3), 3);
    rows.push(...batch.rows);
    if (++batches === 1) db.prepare('INSERT INTO notes(body) VALUES (?)').run('arrived during export');
    if (batch.next === null) break;
    after = batch.next;
  }
  assert.equal(rows.length, 6);
  assert.equal(rows.at(-1).body, 'arrived during export');
});

test('internal and unsafe table names are rejected', () => {
  assert.equal(isExportableTable('contacts'), true);
  assert.equal(isExportableTable('sqlite_sequence'), false);
  assert.equal(isExportableTable('_cf_KV'), false);
  assert.equal(isExportableTable('contacts; DROP TABLE contacts'), false);
  assert.throws(() => quoteTable('a"b'));
  assert.equal(clampLimit('999999', 200, 200), 200);
  assert.equal(clampLimit('abc', 200, 200), 200);
});

test('file keys become safe Windows paths and cannot escape the folder', () => {
  assert.deepEqual(safeFilePath('call-recordings/12/abc.mp3'), ['call-recordings', '12', 'abc.mp3']);
  assert.deepEqual(safeFilePath('sms-media/a:b?c'), ['sms-media', 'a_b_c']);
  assert.deepEqual(safeFilePath('voice-memos/name.'), ['voice-memos', 'name_']);
  for (const bad of ['../secrets', 'a//b', '/abs', 'a/./b', '']) assert.throws(() => safeFilePath(bad));
});

const base = {
  startedAt: 's', finishedAt: 'f',
  expectedTables: [{ name: 'contacts', rows: 3 }, { name: 'notes', rows: 2 }],
  expectedFiles: [{ key: 'a.mp3', size: 10 }, { key: 'b.pdf', size: 20 }],
  recordings: { saved: 1, gone: [] }, failures: [],
};

test('report passes when everything was copied, including new rows', () => {
  const r = buildReport({ ...base, writtenTables: { contacts: 4, notes: 2 }, writtenFiles: [{ key: 'a.mp3', size: 10 }, { key: 'b.pdf', size: 20 }] });
  assert.equal(r.ok, true);
  assert.match(r.text, /RESULT: complete/);
});

test('report flags a missing row, missing file, and wrong size', () => {
  const r = buildReport({ ...base, writtenTables: { contacts: 2, notes: 2 }, writtenFiles: [{ key: 'a.mp3', size: 9 }] });
  assert.equal(r.ok, false);
  assert.equal(r.problems.length, 3);
  assert.ok(r.problems.some((p) => p.includes('contacts')));
  assert.ok(r.problems.some((p) => p.includes('File missing: b.pdf')));
  assert.ok(r.problems.some((p) => p.includes('size mismatch: a.mp3')));
});

test('recordings already gone at Telnyx are listed but are not problems', () => {
  const r = buildReport({ ...base, writtenTables: { contacts: 3, notes: 2 }, writtenFiles: [{ key: 'a.mp3', size: 10 }, { key: 'b.pdf', size: 20 }], recordings: { saved: 0, gone: [41, 42] } });
  assert.equal(r.ok, true);
  assert.match(r.text, /communication 41: gone/);
});
