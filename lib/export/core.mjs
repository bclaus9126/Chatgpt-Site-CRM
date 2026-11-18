// Shared logic for the CRM data export (design note 0001).
// Plain JavaScript with no Cloudflare imports, so tests can run it directly.

// Batch sizes stay small so no single request holds the database for long.
// Telnyx webhooks share this database and must never wait behind an export.
export const ROW_BATCH = 200;
export const FILE_LIST_BATCH = 500;
export const RECORDING_LIST_BATCH = 200;

// SQLite and Cloudflare keep internal tables that are not CRM data.
export function isExportableTable(name) {
  if (typeof name !== "string") return false;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return false;
  return !name.startsWith("sqlite_") && !name.startsWith("_cf_");
}

// Table names can't be passed as query parameters, so they are checked
// against the live table list and wrapped in quotes before use.
export function quoteTable(name) {
  if (!isExportableTable(name)) throw new Error("Invalid table name");
  return `"${name}"`;
}

export function clampLimit(value, fallback, max) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

// Reads one batch of rows after a given row number. Every SQLite table here
// has a hidden row number (rowid), which makes paging exact: no row is
// skipped or repeated, even when new rows arrive mid-export.
export function tableBatchSql(name) {
  return `SELECT rowid AS __export_rowid, * FROM ${quoteTable(name)} WHERE rowid > ? ORDER BY rowid LIMIT ?`;
}

export function splitBatch(results, limit) {
  const rows = [];
  let last = null;
  for (const raw of results) {
    const { __export_rowid, ...row } = raw;
    last = __export_rowid;
    rows.push(row);
  }
  return { rows, next: results.length === limit ? last : null };
}

// R2 keys become folder paths on Windows. Characters Windows forbids are
// replaced, and anything that could escape the backup folder is rejected.
export function safeFilePath(key) {
  if (typeof key !== "string" || !key) throw new Error("Empty file key");
  const parts = key.split("/");
  if (parts.some((p) => p === "" || p === "." || p === "..")) {
    throw new Error(`Unsafe file key: ${key}`);
  }
  return parts.map((p) => p.replace(/[<>:"\\|?*\u0000-\u001f]/g, "_").replace(/[. ]+$/, (m) => "_".repeat(m.length)));
}

// Compares what the server said exists with what was actually written.
// More rows than expected is fine (new data arrived during the export).
// Fewer rows, or a missing file, is flagged.
export function buildReport({ startedAt, finishedAt, expectedTables, writtenTables, expectedFiles, writtenFiles, recordings, failures }) {
  const problems = [];
  const lines = [];
  lines.push("Claus CRM export report");
  lines.push(`Started:  ${startedAt}`);
  lines.push(`Finished: ${finishedAt}`);
  lines.push("");
  lines.push("TABLES (rows written / rows at start)");
  for (const t of expectedTables) {
    const written = writtenTables[t.name] ?? 0;
    const flag = written < t.rows ? "  <-- FEWER THAN EXPECTED" : "";
    if (flag) problems.push(`Table ${t.name}: wrote ${written} of ${t.rows} rows`);
    lines.push(`  ${t.name}: ${written} / ${t.rows}${flag}`);
  }
  const writtenKeys = new Map(writtenFiles.map((f) => [f.key, f.size]));
  let fileBytes = 0;
  let filesOk = 0;
  for (const f of expectedFiles) {
    if (!writtenKeys.has(f.key)) problems.push(`File missing: ${f.key}`);
    else if (writtenKeys.get(f.key) !== f.size) problems.push(`File size mismatch: ${f.key} (${writtenKeys.get(f.key)} of ${f.size} bytes)`);
    else { filesOk += 1; fileBytes += f.size; }
  }
  lines.push("");
  lines.push(`FILES: ${filesOk} of ${expectedFiles.length} copied (${(fileBytes / 1048576).toFixed(1)} MB)`);
  lines.push("");
  lines.push(`TELNYX-ONLY RECORDINGS: ${recordings.saved} saved, ${recordings.gone.length} no longer available at Telnyx`);
  for (const id of recordings.gone) lines.push(`  communication ${id}: gone`);
  for (const f of failures) problems.push(f);
  lines.push("");
  if (problems.length) {
    lines.push(`PROBLEMS (${problems.length})`);
    for (const p of problems) lines.push(`  ${p}`);
  } else {
    lines.push("RESULT: complete. Every table row and file was copied.");
  }
  return { ok: problems.length === 0, problems, text: lines.join("\n") + "\n" };
}
