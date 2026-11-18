// Lists calls whose recording only exists at Telnyx, one page at a time.
// GET /api/export/recordings?after=0
import { authorizeCrmOwner } from "@/lib/crm-auth";
import { RECORDING_LIST_BATCH } from "@/lib/export/core.mjs";
import { exportEnv, json, TELNYX_ONLY_WHERE } from "@/lib/export/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorizeCrmOwner();
  if (auth.denied) return auth.denied;
  const after = Number(new URL(request.url).searchParams.get("after") || 0);
  if (!Number.isInteger(after) || after < 0) return json({ error: "Invalid cursor" }, 400);
  const { results } = await exportEnv()
    .DB.prepare(`SELECT id FROM communications WHERE ${TELNYX_ONLY_WHERE} AND id > ? ORDER BY id LIMIT ?`)
    .bind(after, RECORDING_LIST_BATCH)
    .all<{ id: number }>();
  const ids = results.map((r) => r.id);
  return json({ ids, next: ids.length === RECORDING_LIST_BATCH ? ids[ids.length - 1] : null });
}
