import { authorizeCrmOwner } from "@/lib/crm-auth";
import { env } from "cloudflare:workers";
import { analyzeSmsConversation } from "@/lib/sms-analysis";

export async function POST(request: Request) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  const { contactId } = await request.json() as { contactId?: number };
  if (!Number.isInteger(contactId) || !contactId || contactId < 1) return Response.json({ error: "Choose a contact" }, { status: 400 });
  const contact = await env.DB.prepare("SELECT first_name,last_name FROM contacts WHERE id=?").bind(contactId).first<Record<string,string>>();
  if (!contact) return Response.json({ error: "Contact not found" }, { status: 404 });
  const records = await env.DB.prepare("SELECT id,author_name,participants,message_transcript,occurred_at,imported FROM communications WHERE contact_id=? AND type IN ('SMS','Text') ORDER BY occurred_at DESC,id DESC LIMIT 60").bind(contactId).all<Record<string,any>>();
  const messages = records.results.map((row) => {
    let participants: Record<string,string> = {};
    try { participants = JSON.parse(row.participants || "{}"); } catch { /* Unknown sender remains unknown. */ }
    return { id: Number(row.id), sender: participants.sender_name || row.author_name || "Unknown", recipient: participants.recipient_name || "Unknown", body: row.message_transcript || "", occurredAt: row.occurred_at };
  });
  const historical = records.results.every((row) => row.imported === 1);
  const suggestions = analyzeSmsConversation(messages, `${contact.first_name} ${contact.last_name}`, historical);
  // Reanalysis replaces pending suggestions only; accepted and dismissed history is preserved.
  for (const row of records.results) await env.DB.prepare("DELETE FROM communication_suggestions WHERE communication_id=? AND status='Suggested'").bind(row.id).run();
  for (const item of suggestions) await env.DB.prepare(`INSERT INTO communication_suggestions
    (communication_id,category,title,detail,due_date,due_time,daypart,scheduling_precision,field_name,field_value,commitment,source_excerpt,needs_review,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(item.sourceMessageId, item.category, item.title, item.detail || null, item.dueDate || null, item.dueTime || null, item.daypart || null, item.schedulingPrecision || null, item.fieldName || null, item.fieldValue || null, item.commitment ? 1 : 0, item.sourceExcerpt, item.needsReview ? 1 : 0).run();
  return Response.json({ ok: true, suggestions: suggestions.length, messages: messages.length, historical });
}
