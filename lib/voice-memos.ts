import { env } from "cloudflare:workers";
import { extractVoiceMemoIntelligence } from "./voice-memo-extraction";

export async function transcribeVoiceMemo(audio: Blob, filename = "voice-memo.webm") {
  const apiKey = (env as unknown as { TELNYX_API_KEY?: string }).TELNYX_API_KEY;
  if (!apiKey) throw new Error("Voice transcription is not configured.");
  const form = new FormData();
  form.set("model", "openai/whisper-large-v3-turbo");
  form.set("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  form.set("file", new File([audio], filename, { type: audio.type || "audio/webm" }));
  const response = await fetch("https://api.telnyx.com/v2/ai/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const result = await response.json() as { text?: string; segments?: unknown; error?: { message?: string } };
  if (!response.ok || !result.text?.trim()) throw new Error(result.error?.message || "Transcription failed.");
  return { transcript: result.text.trim(), timestamps: result.segments ? JSON.stringify(result.segments) : null };
}

export async function saveVoiceMemoSuggestions(db: D1Database, communicationId: number, transcript: string, baseDate?: string) {
  for (const item of extractVoiceMemoIntelligence(transcript, baseDate)) {
    await db.prepare(`INSERT INTO communication_suggestions
      (communication_id,category,title,detail,due_date,due_time,field_name,field_value,commitment,source_excerpt,needs_review)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(communicationId, item.category, item.title, item.detail || null, item.dueDate || null, item.dueTime || null, item.fieldName || null, item.fieldValue || null, item.commitment ? 1 : 0, item.sourceExcerpt, item.needsReview ? 1 : 0).run();
  }
}
