import { authorizeCrmOwner } from "@/lib/crm-auth";
import { env } from "cloudflare:workers";

export async function PATCH(request: Request) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  const body = await request.json().catch(() => ({})) as Record<string,unknown>;
  const id = Number(body.id), title = String(body.title || "").trim();
  const detail = String(body.detail || "").trim(), fieldValue = String(body.fieldValue || "").trim();
  const dueDate = String(body.dueDate || ""), dueTime = String(body.dueTime || "");
  if (!Number.isSafeInteger(id) || id < 1 || !title || title.length > 250 || detail.length > 5000 || fieldValue.length > 1000 || (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) || (dueTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime))) return Response.json({error:"Check the edited fields."},{status:400});
  const current = await env.DB.prepare("SELECT s.* FROM communication_suggestions s JOIN communications c ON c.id=s.communication_id WHERE s.id=? AND s.status='Suggested' AND c.contact_id IS NOT NULL").bind(id).first<Record<string,any>>();
  if (!current) return Response.json({error:"This recommendation is no longer pending."},{status:409});
  const original = current.original_value || JSON.stringify({title:current.title,detail:current.detail,due_date:current.due_date,due_time:current.due_time,field_value:current.field_value});
  const needsReview = ["TASK","FOLLOW-UP","APPOINTMENT","RELATIONSHIP MOMENT"].includes(current.category) && !dueDate ? 1 : 0;
  await env.DB.prepare("UPDATE communication_suggestions SET title=?,detail=?,due_date=?,due_time=?,field_value=?,needs_review=?,original_value=?,edited_by='Brad Claus',edited_at=CURRENT_TIMESTAMP WHERE id=? AND status='Suggested'")
    .bind(title,detail || null,dueDate || null,dueTime || null,fieldValue || null,needsReview,original,id).run();
  return Response.json({ok:true});
}

export async function POST(request: Request) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  const body = await request.json().catch(() => ({})) as {ids?:unknown;reason?:unknown};
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids)].filter((id):id is number => Number.isSafeInteger(id) && id > 0).slice(0,100) : [];
  if (!ids.length || typeof body.reason !== "string" || !["","Incorrect","Not useful","Already handled","Duplicate","Outdated","Other"].includes(body.reason)) return Response.json({error:"Select recommendations to dismiss."},{status:400});
  const updates = await env.DB.batch(ids.map(id => env.DB.prepare("UPDATE communication_suggestions SET status='Dismissed',dismissal_reason=? WHERE id=? AND status='Suggested'").bind(body.reason || null,id)));
  return Response.json({ok:true,resolved:updates.reduce((n,r)=>n+Number(r.meta.changes||0),0)});
}
