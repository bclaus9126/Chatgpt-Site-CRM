// Returns one batch of rows from one table, after a given row number.
// GET /api/export/table?name=contacts&after=0
import { authorizeCrmOwner } from "@/lib/crm-auth";
import { clampLimit, ROW_BATCH, splitBatch, tableBatchSql } from "@/lib/export/core.mjs";
import { exportEnv, json, listTables } from "@/lib/export/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorizeCrmOwner();
  if (auth.denied) return auth.denied;
  const { DB } = exportEnv();
  const params = new URL(request.url).searchParams;
  const name = params.get("name") || "";
  // Only names that really exist in the database are accepted.
  if (!(await listTables(DB)).includes(name)) return json({ error: "Unknown table" }, 400);
  const after = Number(params.get("after") || 0);
  if (!Number.isInteger(after) || after < 0) return json({ error: "Invalid cursor" }, 400);
  const limit = clampLimit(params.get("limit"), ROW_BATCH, ROW_BATCH);
  const { results } = await DB.prepare(tableBatchSql(name)).bind(after, limit).all<Record<string, unknown>>();
  return json(splitBatch(results, limit));
}
