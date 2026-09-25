import { authorizeCrmOwner } from "@/lib/crm-auth";
import { env } from "cloudflare:workers";
import { saveVoiceMemoSuggestions, transcribeVoiceMemo } from "@/lib/voice-memos";

export const dynamic = "force-dynamic";

const clean = (value: FormDataEntryValue | null, max = 200) =>
  String(value || "").trim().slice(0, max);

export async function POST(request: Request) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied; const user = auth.user;
  const form = await request.formData();
  const audio = form.get("audio");
  const contactId = Number(form.get("contactId"));
  if (!(audio instanceof File) || !Number.isInteger(contactId) || contactId <= 0)
    return Response.json({ error: "A contact and recording are required." }, { status: 400 });
  if (audio.size > 30 * 1024 * 1024)
    return Response.json({ error: "Voice memos must be under 30 MB." }, { status: 413 });
  const contact = await env.DB.prepare("SELECT id FROM contacts WHERE id=?").bind(contactId).first();
  if (!contact) return Response.json({ error: "Contact not found." }, { status: 404 });

  const id = crypto.randomUUID();
  const key = `voice-memos/${contactId}/${id}`;
  const bytes = await audio.arrayBuffer();
  if (!bytes.byteLength) return Response.json({ error: "The recording was empty. Please try again." }, { status: 400 });
  await env.FILES.put(key, bytes, { httpMetadata: { contentType: audio.type || "audio/webm" } });
  let transcript = clean(form.get("transcript"), 50000), timestamps: string | null = null, transcriptStatus = "Transcript ready";
  try {
    const result = await transcribeVoiceMemo(new Blob([bytes], { type: audio.type || "audio/webm" }), audio.name || "voice-memo.webm");
    transcript = result.transcript; timestamps = result.timestamps;
  } catch (error) {
    console.error("Voice memo transcription failed", error);
    if (!transcript) transcriptStatus = "Transcription failed";
  }
  const title = clean(form.get("title")) || `Voice Memo · ${new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date())}`;
  const interactionType = clean(form.get("interactionType")) || "In-person follow-up / Voice Memo";
  const duration = Math.max(1, Math.round(Number(form.get("duration")) || 0));
  const summary = transcript ? transcript.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ").slice(0, 500) : null;
  const result = await env.DB.prepare(`INSERT INTO communications
    (contact_id,type,direction,occurred_at,subject,message_transcript,duration_seconds,ai_summary,status,audio_object_key,audio_content_type,interaction_type,author_name,transcription_status,transcript_timestamps,analysis_status,source_system,source_record_id)
    VALUES (?,'Voice Memo','Internal',CURRENT_TIMESTAMP,?,?,?,?,?,?,?,?,?,?,?,?,'voice_memo',?)`)
    .bind(contactId, title, transcript || null, duration, summary, "Saved", key, audio.type || "audio/webm", interactionType, "Brad Claus", transcriptStatus, timestamps, transcript ? "Suggestions ready" : "Waiting for transcript", id).run();
  const communicationId = Number(result.meta.last_row_id);
  await saveVoiceMemoSuggestions(env.DB, communicationId, transcript);
  await env.DB.prepare("UPDATE contacts SET last_meaningful_contact=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(contactId).run();
  return Response.json({ ok: true, communicationId, transcriptionStatus });
}
