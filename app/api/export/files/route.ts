// Lists stored files (R2), one page at a time.
// GET /api/export/files?cursor=...
import { authorizeCrmOwner } from "@/lib/crm-auth";
import { FILE_LIST_BATCH } from "@/lib/export/core.mjs";
import { exportEnv, json } from "@/lib/export/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorizeCrmOwner();
  if (auth.denied) return auth.denied;
  const cursor = new URL(request.url).searchParams.get("cursor") || undefined;
  const page = await exportEnv().FILES.list({ cursor, limit: FILE_LIST_BATCH });
  return json({
    objects: page.objects.map((o) => ({ key: o.key, size: o.size, etag: o.etag, uploaded: o.uploaded.toISOString() })),
    cursor: page.truncated ? page.cursor : null,
  });
}
