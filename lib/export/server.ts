// Server helpers shared by the /api/export routes (design note 0001).
// Every export route is read-only: nothing here writes to D1 or R2.
import { env } from "cloudflare:workers";
import { isExportableTable } from "@/lib/export/core.mjs";

export type ExportEnv = { DB: D1Database; FILES: R2Bucket; TELNYX_API_KEY?: string };
export const exportEnv = () => env as unknown as ExportEnv;

export const noStore = { "Cache-Control": "private, no-store" };
export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: noStore });

// The live table list comes from the database itself, not from db/schema.ts,
// so tables that exist only in migrations are still exported.
export async function listTables(db: D1Database): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all<{ name: string }>();
  return results.map((r) => r.name).filter(isExportableTable);
}

// Calls whose audio only exists at Telnyx: a recording ID, but no copy in R2.
export const TELNYX_ONLY_WHERE =
  "recording_id IS NOT NULL AND recording_id <> '' AND (audio_object_key IS NULL OR audio_object_key = '')";
