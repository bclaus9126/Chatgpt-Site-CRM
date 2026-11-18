// Downloads one call recording that only exists at Telnyx.
// Telnyx's saved links expire within minutes, so this asks the Telnyx API
// for a fresh link using the recording ID, then streams the audio through.
// It only reads from Telnyx. Nothing is saved to R2 or the database.
// GET /api/export/recording?id=<communication id>
import { authorizeCrmOwner } from "@/lib/crm-auth";
import { exportEnv, json, noStore } from "@/lib/export/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorizeCrmOwner();
  if (auth.denied) return auth.denied;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return json({ error: "Invalid id" }, 400);
  const { DB, TELNYX_API_KEY } = exportEnv();
  const call = await DB.prepare("SELECT recording_id FROM communications WHERE id=?")
    .bind(id)
    .first<{ recording_id: string | null }>();
  if (!call?.recording_id) return json({ error: "No recording" }, 404);
  if (!TELNYX_API_KEY) return json({ error: "Telnyx key not configured" }, 503);

  const meta = await fetch(`https://api.telnyx.com/v2/recordings/${encodeURIComponent(call.recording_id)}`, {
    headers: { Authorization: `Bearer ${TELNYX_API_KEY}`, Accept: "application/json" },
  });
  // 404 means Telnyx no longer has it. The page records it as gone.
  if (meta.status === 404) return json({ error: "Gone at Telnyx" }, 410);
  if (!meta.ok) return json({ error: `Telnyx lookup failed (${meta.status})` }, 502);
  const body = (await meta.json()) as { data?: { download_urls?: { mp3?: string; wav?: string } } };
  const url = body.data?.download_urls?.mp3 || body.data?.download_urls?.wav;
  if (!url) return json({ error: "Gone at Telnyx" }, 410);

  const audio = await fetch(url);
  if (!audio.ok || !audio.body) return json({ error: `Telnyx download failed (${audio.status})` }, 502);
  const headers: Record<string, string> = { ...noStore, "Content-Type": body.data?.download_urls?.mp3 ? "audio/mpeg" : "audio/wav" };
  const length = audio.headers.get("content-length");
  if (length) headers["Content-Length"] = length;
  return new Response(audio.body, { headers });
}
