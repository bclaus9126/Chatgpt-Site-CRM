import { authorizeCrmOwner } from "@/lib/crm-auth";
import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  const communicationId = Number((await params).id);
  const memo = await env.DB.prepare("SELECT audio_object_key,audio_content_type FROM communications WHERE id=? AND type='Voice Memo'").bind(communicationId).first<{ audio_object_key: string; audio_content_type: string }>();
  if (!memo?.audio_object_key) return Response.json({ error: "Recording unavailable" }, { status: 404 });
  const metadata = await env.FILES.head(memo.audio_object_key);
  if (!metadata || metadata.size === 0) return Response.json({ error: "Recording unavailable" }, { status: 404 });
  const range = request.headers.get("range");
  const match = range?.match(/^bytes=(\d*)-(\d*)$/);
  let start = 0, end = metadata.size - 1, partial = false;
  if (match) {
    if (match[1]) start = Math.min(Number(match[1]), metadata.size - 1);
    if (match[2]) end = Math.min(Number(match[2]), metadata.size - 1);
    if (!match[1] && match[2]) start = Math.max(0, metadata.size - Number(match[2]));
    if (end < start) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${metadata.size}` } });
    partial = true;
  }
  const length = end - start + 1;
  const object = await env.FILES.get(memo.audio_object_key, partial ? { range: { offset: start, length } } : undefined);
  if (!object) return Response.json({ error: "Recording unavailable" }, { status: 404 });
  const headers = new Headers({ "Content-Type": memo.audio_content_type || "audio/webm", "Cache-Control": "private, no-store", "Accept-Ranges": "bytes" });
  headers.set("Content-Length", String(partial ? length : metadata.size));
  if (partial) headers.set("Content-Range", `bytes ${start}-${end}/${metadata.size}`);
  return new Response(object.body, { status: partial ? 206 : 200, headers });
}
