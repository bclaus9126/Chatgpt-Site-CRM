import { authorizeCrmOwner } from "@/lib/crm-auth";
import { env } from "cloudflare:workers";

export async function PATCH(request: Request) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  const { id, contactId, title, dueDate, dueTime, fieldValue } = await request.json() as Record<string,any>;
  if (!Number.isInteger(id) || !Number.isInteger(contactId) || typeof title !== "string" || !title.trim() || title.length > 250 || (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) || (dueTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime))) return Response.json({ error: "Check the edited fields" }, { status: 400 });
  const found = await env.DB.prepare("SELECT s.id FROM communication_suggestions s JOIN communications c ON c.id=s.communication_id WHERE s.id=? AND c.contact_id=? AND c.type IN ('SMS','Text','Email') AND s.status='Suggested'").bind(id, contactId).first();
  if (!found) return Response.json({ error: "Suggestion not found" }, { status: 404 });
  await env.DB.prepare("UPDATE communication_suggestions SET title=?,due_date=?,due_time=?,field_value=?,needs_review=0 WHERE id=?").bind(title.trim(), dueDate || null, dueTime || null, typeof fieldValue === "string" ? fieldValue.slice(0,500) : null, id).run();
  return Response.json({ ok: true });
}
