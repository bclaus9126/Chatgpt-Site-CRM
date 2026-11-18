// Lists what the export should contain: every table with its row count,
// and how many calls have recordings that only exist at Telnyx.
import { authorizeCrmOwner } from "@/lib/crm-auth";
import { quoteTable } from "@/lib/export/core.mjs";
import { exportEnv, json, listTables, TELNYX_ONLY_WHERE } from "@/lib/export/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authorizeCrmOwner();
  if (auth.denied) return auth.denied;
  const { DB } = exportEnv();
  const startedAt = new Date().toISOString();
  const tables: { name: string; rows: number }[] = [];
  // One small COUNT per table, one at a time, to keep each query short.
  for (const name of await listTables(DB)) {
    const row = await DB.prepare(`SELECT COUNT(*) AS n FROM ${quoteTable(name)}`).first<{ n: number }>();
    tables.push({ name, rows: Number(row?.n ?? 0) });
  }
  const rec = await DB.prepare(`SELECT COUNT(*) AS n FROM communications WHERE ${TELNYX_ONLY_WHERE}`).first<{ n: number }>();
  return json({ startedAt, tables, telnyxOnlyRecordings: Number(rec?.n ?? 0) });
}
