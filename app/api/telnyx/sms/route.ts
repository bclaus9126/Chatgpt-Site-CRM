import { env, waitUntil } from "cloudflare:workers";
import { verifyTelnyxSignature } from "@/app/api/telnyx/voice/route";
import { normalizePhone, BUSINESS_NUMBER, BRAD_CELL } from "@/lib/telnyx-call-control";
import { analyzeSmsConversation } from "@/lib/sms-analysis";
import { createInboundDraft } from "@/lib/claus-ai/auto-draft";
import { indexPending } from "@/lib/claus-ai/indexer";
import { archiveInboundImages } from "@/lib/telnyx-media";
import { stopContact } from "@/lib/campaign";
import { notifyInboundSms } from "@/lib/push";

export const dynamic = "force-dynamic";
type Row = Record<string, any>;
const number = (value: unknown) => normalizePhone(typeof value === "string" ? value : (value as Row)?.phone_number);
const recipient = (p: Row) => number(Array.isArray(p.to) ? p.to[0] : p.to);
const key = (id: string) => `telnyx-sms:${id}`;

async function matchingContact(phone: string) {
  const contacts = await env.DB.prepare("SELECT id,first_name,last_name,phone FROM contacts").all<Row>();
  const methods = await env.DB.prepare("SELECT contact_id FROM contact_methods WHERE kind='phone' AND normalized_value=?").bind(phone).all<Row>();
  const matches = contacts.results.filter(c => number(c.phone) === phone || methods.results.some(m => Number(m.contact_id) === Number(c.id)));
  return matches.length === 1 ? matches[0] : null;
}
async function analyzeInbound(contact: Row, communicationId: number) {
  const history = await env.DB.prepare("SELECT id,author_name,participants,message_transcript,occurred_at FROM communications WHERE contact_id=? AND type IN ('SMS','Text') ORDER BY occurred_at DESC,id DESC LIMIT 30").bind(contact.id).all<Row>();
  const messages = history.results.map(row => {
    let p: Row = {}; try { p = JSON.parse(row.participants || "{}"); } catch {}
    return { id: Number(row.id), sender: p.sender_name || row.author_name || "Unknown", recipient: p.recipient_name || "Unknown", body: row.message_transcript || "", occurredAt: row.occurred_at };
  });
  const suggestions = analyzeSmsConversation(messages, `${contact.first_name} ${contact.last_name}`);
  // Reprocessing this new message never removes reviewed actions from earlier messages.
  for (const item of suggestions.filter(s => s.sourceMessageId === communicationId)) await env.DB.prepare(`INSERT INTO communication_suggestions (communication_id,category,title,detail,due_date,due_time,daypart,scheduling_precision,field_name,field_value,commitment,source_excerpt,needs_review) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(communicationId,item.category,item.title,item.detail || null,item.dueDate || null,item.dueTime || null,item.daypart || null,item.schedulingPrecision || null,item.fieldName || null,item.fieldValue || null,item.commitment ? 1 : 0,item.sourceExcerpt,item.needsReview ? 1 : 0).run();
  await createInboundDraft(env.DB,communicationId);
}
async function handle(event: Row, origin: string) {
  const data = event.data || {}, p = data.payload || {}, type = data.event_type;
  if (!p.id || !["message.received","message.sent","message.finalized"].includes(type)) return;
  const id = String(p.id), from = number(p.from), to = recipient(p);
  // A call-context notice is internal: never attach it to a client or analyze it.
  if (from === BUSINESS_NUMBER && to === BRAD_CELL) return;
  if (type === "message.finalized") {
    const statuses = Array.isArray(p.to) ? p.to.map((r: Row) => String(r.status || "")) : [];
    const status = statuses.includes("delivered") ? "Delivered" : statuses.some((s: string) => /fail/i.test(s)) ? "Failed" : String(p.status || "Finalized").slice(0,80);
    const errors = [...(Array.isArray(p.errors) ? p.errors : []),...(Array.isArray(p.to) ? p.to.flatMap((r: Row) => Array.isArray(r.errors) ? r.errors : []) : [])];
    const reason = errors.map((e: Row) => [e.code,e.title || e.detail].filter(Boolean).join(": ")).filter(Boolean).join("; ").slice(0,500);
    await env.DB.prepare("UPDATE communications SET status=?,subject=? WHERE external_provider_id=? AND source_system='telnyx' AND type='SMS'").bind(status,reason || null,key(id)).run();
    return;
  }
  const hasMedia = Array.isArray(p.media) && p.media.length > 0;
  if ((!p.text || !String(p.text).trim()) && !hasMedia) return;
  const inbound = type === "message.received", phone = inbound ? from : to;
  if (!phone || !from || !to || (inbound && to !== BUSINESS_NUMBER)) return;
  const contact = await matchingContact(phone);
  const media = inbound ? await archiveInboundImages(p.media,origin) : [];
  const contactName = contact ? `${contact.first_name} ${contact.last_name}`.trim() : phone;
  const time = Date.parse(data.occurred_at || p.received_at || p.sent_at || "");
  const occurredAt = Number.isFinite(time) ? new Date(time).toISOString() : new Date().toISOString();
  const saved = await env.DB.prepare(`INSERT INTO communications (contact_id,type,direction,occurred_at,message_transcript,status,source_system,source_record_id,external_provider_id,from_number,to_number,imported,author_name,participants)
    VALUES (?,'SMS',?,?,?,?,?,?,?,?,?,0,?,?) ON CONFLICT(external_provider_id) DO NOTHING`)
    .bind(contact?.id ?? null,inbound ? "inbound" : "outbound",occurredAt,String(p.text || ""),inbound ? "Received" : "Sent","telnyx",id,key(id),from,to,inbound ? contactName : "Brad Claus",JSON.stringify({sender_name:inbound ? contactName : "Brad Claus",recipient_name:inbound ? "Brad Claus" : contactName,from,to,telnyx_message_id:id,media})).run();
  if (!saved.meta.changes) return;
  const communicationId = Number(saved.meta.last_row_id);
  if (inbound && contact) {
    if (/^\s*(stop|unsubscribe|cancel|end|quit)\s*[.!]?\s*$/i.test(String(p.text || ""))) await env.DB.prepare("UPDATE contacts SET sms_opt_out=1 WHERE id=?").bind(contact.id).run();
    await stopContact(Number(contact.id),"Inbound SMS reply",occurredAt);
  }
  if (inbound) waitUntil(notifyInboundSms(communicationId,contact,phone,String(p.text || ""),origin).catch(() => console.error("SMS push deferred")));
  waitUntil(indexPending(env.DB,1,false,`communication:${communicationId}`).catch(() => console.error("SMS indexing deferred")));
  if (inbound && contact) waitUntil(analyzeInbound(contact,communicationId).catch(() => console.error("SMS intelligence deferred")));
}
export async function POST(request: Request) {
  const raw = new Uint8Array(await request.arrayBuffer());
  if (!(await verifyTelnyxSignature(request,raw))) return Response.json({error:"Invalid signature"},{status:401});
  let event: Row; try { event = JSON.parse(new TextDecoder().decode(raw)); } catch { return Response.json({error:"Invalid JSON"},{status:400}); }
  waitUntil(handle(event,new URL(request.url).origin).catch(() => console.error("SMS webhook processing failed")));
  return Response.json({ok:true});
}
