// Streams one stored file (R2) to the export page.
// GET /api/export/file?key=call-recordings/12/abc.mp3
import { authorizeCrmOwner } from "@/lib/crm-auth";
import { exportEnv, json, noStore } from "@/lib/export/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorizeCrmOwner();
  if (auth.denied) return auth.denied;
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!key) return json({ error: "Missing key" }, 400);
  const object = await exportEnv().FILES.get(key);
  if (!object) return json({ error: "Not found" }, 404);
  return new Response(object.body, {
    headers: { ...noStore, "Content-Type": "application/octet-stream", "Content-Length": String(object.size) },
  });
}
