import { authorizeCrmOwner } from "@/lib/crm-auth";
import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

const allowedRecordingHost = (hostname: string) =>
  hostname === "telnyx.com" ||
  hostname.endsWith(".telnyx.com") ||
  hostname === "amazonaws.com" ||
  hostname.endsWith(".amazonaws.com");

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;

  const { id } = await params;
  const communicationId = Number(id);
  if (!Number.isInteger(communicationId) || communicationId <= 0)
    return Response.json({ error: "Invalid recording" }, { status: 400 });

  const call = await env.DB.prepare(
    "SELECT recording_url,audio_object_key,audio_content_type FROM communications WHERE id=?",
  )
    .bind(communicationId)
    .first<{ recording_url: string | null; audio_object_key: string | null; audio_content_type: string | null }>();
  if (call?.audio_object_key) {
    const audio = await env.FILES.get(call.audio_object_key);
    if (audio) {
      const headers = new Headers();
      audio.writeHttpMetadata(headers);
      headers.set("Content-Type", call.audio_content_type || headers.get("Content-Type") || "audio/mpeg");
      headers.set("Cache-Control", "private, no-store");
      headers.set("Content-Disposition", "inline");
      return new Response(audio.body, { headers });
    }
  }
  if (!call?.recording_url)
    return Response.json({ error: "Recording unavailable" }, { status: 404 });

  let source: URL;
  try {
    source = new URL(call.recording_url);
  } catch {
    return Response.json({ error: "Recording unavailable" }, { status: 404 });
  }
  if (source.protocol !== "https:" || !allowedRecordingHost(source.hostname))
    return Response.json({ error: "Recording unavailable" }, { status: 404 });

  const range = request.headers.get("range");
  const upstream = await fetch(source.toString(), {
    headers: range ? { Range: range } : undefined,
  });
  if (!upstream.ok && upstream.status !== 206)
    return Response.json({ error: "Recording unavailable" }, { status: 502 });

  const headers = new Headers();
  for (const name of [
    "accept-ranges",
    "content-length",
    "content-range",
    "content-type",
  ]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Disposition", "inline");
  return new Response(upstream.body, { status: upstream.status, headers });
}
