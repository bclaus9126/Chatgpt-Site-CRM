import { authorizeCrmOwner } from "@/lib/crm-auth";
import { env } from "cloudflare:workers";
import { saveVoiceMemoSuggestions, transcribeVoiceMemo } from "@/lib/voice-memos";
import { centralDate } from "@/lib/voice-memo-extraction";

export const dynamic = "force-dynamic";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  const communicationId = Number((await params).id);
  const memo = await env.DB.prepare("SELECT audio_object_key,audio_content_type,occurred_at FROM communications WHERE id=? AND type='Voice Memo'").bind(communicationId).first<{ audio_object_key: string; audio_content_type: string; occurred_at: string }>();
  if (!memo?.audio_object_key) return Response.json({ error: "Recording unavailable" }, { status: 404 });
  await env.DB.prepare("UPDATE communications SET transcription_status='Processing' WHERE id=?").bind(communicationId).run();
  const object = await env.FILES.get(memo.audio_object_key);
  if (!object) return Response.json({ error: "Recording unavailable" }, { status: 404 });
  try {
    const bytes = await object.arrayBuffer();
    const result = await transcribeVoiceMemo(new Blob([bytes], { type: memo.audio_content_type || "audio/webm" }));
    const summary = result.transcript.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ").slice(0, 500);
    await env.DB.batch([
      env.DB.prepare("UPDATE communications SET message_transcript=?,transcript_timestamps=?,transcription_status='Transcript ready',analysis_status='Suggestions ready',ai_summary=? WHERE id=?").bind(result.transcript, result.timestamps, summary, communicationId),
      env.DB.prepare("DELETE FROM communication_suggestions WHERE communication_id=? AND status='Suggested'").bind(communicationId),
    ]);
    const recordedAt = new Date(memo.occurred_at.includes("T") ? memo.occurred_at : `${memo.occurred_at.replace(" ", "T")}Z`);
    await saveVoiceMemoSuggestions(env.DB, communicationId, result.transcript, centralDate(recordedAt));
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Voice memo retry failed", error);
    await env.DB.prepare("UPDATE communications SET transcription_status='Transcription failed' WHERE id=?").bind(communicationId).run();
    return Response.json({ error: "Transcription failed. The original audio is still safe." }, { status: 502 });
  }
}
