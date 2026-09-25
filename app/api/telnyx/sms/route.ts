import { env, waitUntil } from "cloudflare:workers";
import { verifyTelnyxSignature } from "@/app/api/telnyx/voice/route";
import { normalizePhone } from "@/lib/fub-import";
import { analyzeSmsConversation } from "@/lib/sms-analysis";
import { createInboundDraft } from "@/lib/claus-ai/auto-draft";

export const dynamic = "force-dynamic";
async function handle(event: Record<string,any>) {
  const data = event.data || {}, payload = data.payload || {};
  if (!["message.received", "message.sent"].includes(data.event_type) || !payload.id || typeof payload.text !== "string") return;
  const from = typeof payload.from === "string" ? payload.from : payload.from?.phone_number;
  const recipient = Array.isArray(payload.to) ? payload.to[0]?.phone_number : typeof payload.to === "string" ? payload.to : payload.to?.phone_number;
  const inbound = data.event_type === "message.received";
  const contactPhone = normalizePhone(inbound ? from : recipient);
  if (!contactPhone) return;
  const matches = await env.DB.prepare("SELECT DISTINCT c.id,c.first_name,c.last_name FROM contacts c LEFT JOIN contact_methods m ON m.contact_id=c.id AND m.kind='phone' WHERE c.phone=? OR m.normalized_value=? LIMIT 2").bind(contactPhone,contactPhone).all<Record<string,any>>();
  if (matches.results.length !== 1) { console.warn("SMS contact could not be matched uniquely", data.id); return; }
  const contact = matches.results[0];
  const existing = await env.DB.prepare("SELECT id FROM communications WHERE external_provider_id=?").bind(`telnyx-sms:${payload.id}`).first();
  if (existing) return;
  const timestamp = Date.parse(data.occurred_at || payload.received_at || payload.sent_at || "");
  if (!Number.isFinite(timestamp)) return;
  const result = await env.DB.prepare("INSERT OR IGNORE INTO communications (contact_id,type,direction,occurred_at,message_transcript,status,source_system,source_record_id,external_provider_id,imported,author_name,participants) VALUES (?,'SMS',?,?,?,?,?,?,?,?,?,?)")
    .bind(contact.id, inbound ? "inbound" : "outbound", new Date(timestamp).toISOString(), String(payload.text || ""), "Received", "telnyx", String(payload.id), `telnyx-sms:${payload.id}`, 0, inbound ? `${contact.first_name} ${contact.last_name}` : "Brad Claus", JSON.stringify({ sender_name: inbound ? `${contact.first_name} ${contact.last_name}` : "Brad Claus", recipient_name: inbound ? "Brad Claus" : `${contact.first_name} ${contact.last_name}` })).run();
  if (!result.meta.changes) return;
  const history = await env.DB.prepare("SELECT id,author_name,participants,message_transcript,occurred_at FROM communications WHERE contact_id=? AND type IN ('SMS','Text') ORDER BY occurred_at DESC,id DESC LIMIT 30").bind(contact.id).all<Record<string,any>>();
  const messages = history.results.map((row) => { let p: Record<string,string> = {}; try { p = JSON.parse(row.participants || "{}"); } catch {} return { id: Number(row.id), sender: p.sender_name || row.author_name || "Unknown", recipient: p.recipient_name || "Unknown", body: row.message_transcript || "", occurredAt: row.occurred_at }; });
  const suggestions = analyzeSmsConversation(messages, `${contact.first_name} ${contact.last_name}`);
  for (const row of history.results) await env.DB.prepare("DELETE FROM communication_suggestions WHERE communication_id=? AND status='Suggested'").bind(row.id).run();
  for (const item of suggestions) await env.DB.prepare(`INSERT INTO communication_suggestions (communication_id,category,title,detail,due_date,due_time,daypart,scheduling_precision,field_name,field_value,commitment,source_excerpt,needs_review) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(item.sourceMessageId,item.category,item.title,item.detail || null,item.dueDate || null,item.dueTime || null,item.daypart || null,item.schedulingPrecision || null,item.fieldName || null,item.fieldValue || null,item.commitment ? 1 : 0,item.sourceExcerpt,item.needsReview ? 1 : 0).run();
  if (inbound) await createInboundDraft(env.DB, Number(result.meta.last_row_id));
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!(await verifyTelnyxSignature(request, raw))) return Response.json({ error: "Invalid signature" }, { status: 401 });
  let event: Record<string,any>;
  try { event = JSON.parse(raw); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  waitUntil(handle(event).catch((error) => console.error("SMS webhook processing failed", error)));
  return Response.json({ ok: true });
}
