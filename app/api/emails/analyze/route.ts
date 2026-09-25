import { authorizeCrmOwner } from "@/lib/crm-auth";
import { env } from "cloudflare:workers";
import { analyzeEmailThread } from "@/lib/email-analysis";

export async function POST(request: Request) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  const { contactId, threadId } = await request.json() as { contactId?: number; threadId?: string };
  if (!Number.isInteger(contactId) || !contactId || contactId < 1) return Response.json({ error: "Choose a contact" }, { status: 400 });
  const contact = await env.DB.prepare("SELECT first_name,last_name FROM contacts WHERE id=?").bind(contactId).first<Record<string,string>>();
  if (!contact) return Response.json({ error: "Contact not found" }, { status: 404 });
  const rows = await env.DB.prepare("SELECT id,author_name,participants,subject,message_transcript,occurred_at,imported FROM communications WHERE contact_id=? AND type='Email' ORDER BY occurred_at DESC,id DESC LIMIT 100").bind(contactId).all<Record<string,any>>();
  const parse = (value: string) => { try { return JSON.parse(value || "{}"); } catch { return {}; } };
  const selected = rows.results.filter(row => !threadId || parse(row.participants).thread_id === threadId);
  const groups = new Map<string, typeof selected>();
  for (const row of selected) { const key = parse(row.participants).thread_id || `message:${row.id}`; groups.set(key, [...(groups.get(key) || []), row]); }
  let count = 0;
  for (const group of groups.values()) {
    const messages = group.map(row => { const p = parse(row.participants); return { id: Number(row.id), sender: p.sender_name || row.author_name || "Unknown", recipient: p.recipient_name || "Unknown", body: row.message_transcript || "", occurredAt: row.occurred_at }; });
    const historical = group.every(row => row.imported === 1);
    const suggestions = analyzeEmailThread(messages, `${contact.first_name} ${contact.last_name}`, historical);
    for (const row of group) await env.DB.prepare("DELETE FROM communication_suggestions WHERE communication_id=? AND status='Suggested'").bind(row.id).run();
    for (const item of suggestions) {
      // Imported mail is searchable and available for optional review, but never creates stale action proposals.
      if (historical && ["TASK", "FOLLOW-UP", "APPOINTMENT"].includes(item.category)) continue;
      await env.DB.prepare(`INSERT INTO communication_suggestions (communication_id,category,title,detail,due_date,due_time,daypart,scheduling_precision,field_name,field_value,commitment,source_excerpt,needs_review,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(item.sourceMessageId,item.category,item.title,item.detail || null,item.dueDate || null,item.dueTime || null,item.daypart || null,item.schedulingPrecision || null,item.fieldName || null,item.fieldValue || null,item.commitment ? 1 : 0,item.sourceExcerpt,item.needsReview ? 1 : 0).run();
      count++;
    }
  }
  return Response.json({ ok: true, suggestions: count, messages: selected.length });
}
