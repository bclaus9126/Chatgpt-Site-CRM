import { authorizeCrmOwner } from "@/lib/crm-auth";
import { MAILBOX } from "@/lib/microsoft/graph";
import { env, waitUntil } from "cloudflare:workers";
import { analyzeEmailThread } from "@/lib/email-analysis";
import { createInboundDraft } from "@/lib/claus-ai/auto-draft";

type Incoming = { messageId: string; threadId?: string; sender: string; recipients: string[]; timestamp: string; subject?: string; body: string; historical?: boolean; attachments?: { name: string; contentType?: string }[] };
const normalized = (value: string) => value.trim().toLowerCase();

// Authenticated mailbox-sync ingestion contract. A mailbox provider must call this
// through an authorized integration; browser clients cannot spoof provider webhooks.
export async function POST(request: Request) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  const mail = await request.json() as Incoming;
  if (!mail.messageId || mail.messageId.length > 250 || !mail.sender || !Array.isArray(mail.recipients) || !mail.recipients.length || !mail.body || mail.body.length > 200000 || !Number.isFinite(Date.parse(mail.timestamp)) || !Array.isArray(mail.attachments || []) || (mail.attachments?.length || 0) > 30) return Response.json({ error: "Invalid email" }, { status: 400 });
  const addresses = [mail.sender, ...mail.recipients].map(normalized);
  const contacts = await env.DB.prepare("SELECT id,first_name,last_name,email FROM contacts").all<Record<string,any>>();
  const methods = await env.DB.prepare("SELECT contact_id,normalized_value FROM contact_methods WHERE kind='email'").all<Record<string,any>>();
  const ids = [...new Set([...contacts.results.filter(c => addresses.includes(normalized(c.email || ""))).map(c => Number(c.id)), ...methods.results.filter(m => addresses.includes(normalized(m.normalized_value || ""))).map(m => Number(m.contact_id))])];
  if (!ids.length) return Response.json({ error: "No matching contact email address; link the contact before importing" }, { status: 409 });
  const participants = JSON.stringify({ sender_name: normalized(mail.sender) === MAILBOX ? "Brad Claus" : (contacts.results.find(c => normalized(c.email || "") === normalized(mail.sender)) ? `${contacts.results.find(c => normalized(c.email || "") === normalized(mail.sender))!.first_name} ${contacts.results.find(c => normalized(c.email || "") === normalized(mail.sender))!.last_name}` : mail.sender), recipient_name: mail.recipients.join(", "), sender: mail.sender, recipients: mail.recipients, thread_id: mail.threadId || mail.messageId, attachments: (mail.attachments || []).map(a => ({ name: String(a.name).slice(0,255), content_type: a.contentType || null, source_message_id: mail.messageId, sender: mail.sender, timestamp: mail.timestamp })) });
  let created = 0;
  for (const contactId of ids) {
    const sourceId = `email:${contactId}:${mail.messageId}`;
    const existing = await env.DB.prepare("SELECT id FROM communications WHERE source_system='email' AND source_record_id=? LIMIT 1").bind(sourceId).first();
    if (existing) continue;
    const result = await env.DB.prepare("INSERT INTO communications (contact_id,type,direction,occurred_at,subject,message_transcript,author_name,participants,source_system,source_record_id,imported,status) VALUES (?,'Email',?,?,?,?,?,?,?,?,?,'Saved')").bind(contactId,normalized(mail.sender) === MAILBOX ? "outbound" : "inbound",new Date(mail.timestamp).toISOString(),mail.subject || null,mail.body,mail.sender,participants,"email",sourceId,mail.historical ? 1 : 0).run();
    created++;
    if (!mail.historical && normalized(mail.sender) !== MAILBOX && result.meta.last_row_id) waitUntil(createInboundDraft(env.DB, Number(result.meta.last_row_id)).catch(error => console.error("Email draft generation failed", { timestamp: new Date().toISOString(), error: error instanceof Error ? error.message : "Unknown" })));
    if (!mail.historical && result.meta.last_row_id) {
      const contact = contacts.results.find(c => Number(c.id) === contactId);
      const thread = mail.threadId || mail.messageId;
      const rows = await env.DB.prepare("SELECT id,author_name,participants,message_transcript,occurred_at FROM communications WHERE contact_id=? AND type='Email' ORDER BY occurred_at DESC,id DESC LIMIT 100").bind(contactId).all<Record<string,any>>();
      const selected = rows.results.filter(row => { try { return JSON.parse(row.participants || "{}").thread_id === thread; } catch { return false; } });
      const messages = selected.map(row => { const p = JSON.parse(row.participants || "{}"); return { id:Number(row.id), sender:p.sender_name || row.author_name, recipient:p.recipient_name || "", body:row.message_transcript || "", occurredAt:row.occurred_at }; });
      const suggestions = analyzeEmailThread(messages, `${contact?.first_name || "Contact"} ${contact?.last_name || ""}`);
      for (const row of selected) await env.DB.prepare("DELETE FROM communication_suggestions WHERE communication_id=? AND status='Suggested'").bind(row.id).run();
      for (const item of suggestions) await env.DB.prepare("INSERT INTO communication_suggestions (communication_id,category,title,detail,due_date,due_time,daypart,scheduling_precision,field_name,field_value,commitment,source_excerpt,needs_review) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(item.sourceMessageId,item.category,item.title,item.detail || null,item.dueDate || null,item.dueTime || null,item.daypart || null,item.schedulingPrecision || null,item.fieldName || null,item.fieldValue || null,item.commitment ? 1 : 0,item.sourceExcerpt,item.needsReview ? 1 : 0).run();
    }
  }
  return Response.json({ ok:true, created, contactIds:ids });
}
