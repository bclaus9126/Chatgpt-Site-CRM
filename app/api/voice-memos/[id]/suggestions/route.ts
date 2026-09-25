import { authorizeCrmOwner } from "@/lib/crm-auth";
import { env } from "cloudflare:workers";
import { syncAppointment } from "@/lib/microsoft/calendar";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  const communicationId = Number((await params).id);
  const body = await request.json() as { ids?: number[]; dismiss?: boolean };
  const memo = await env.DB.prepare("SELECT id,contact_id,message_transcript,type,occurred_at,participants FROM communications WHERE id=? AND type IN ('Voice Memo','Call','SMS','Text','Email')").bind(communicationId).first<{ id: number; contact_id: number; message_transcript: string; type: string; occurred_at: string; participants: string }>();
  if (!memo) return Response.json({ error: "Communication not found" }, { status: 404 });
  if (!memo.contact_id) return Response.json({ error: "This call is not linked to a contact." }, { status: 409 });
  const sourceSystem = memo.type === "Call" ? "call" : memo.type === "Voice Memo" ? "voice_memo" : memo.type === "Email" ? "email" : "sms";
  const ids = (body.ids || []).filter(Number.isInteger).slice(0, 20);
  if (body.dismiss) {
    if (ids.length) for (const id of ids) await env.DB.prepare("UPDATE communication_suggestions SET status='Dismissed' WHERE id=? AND communication_id=? AND status='Suggested'").bind(id, communicationId).run();
    else await env.DB.prepare("UPDATE communication_suggestions SET status='Dismissed' WHERE communication_id=? AND status='Suggested'").bind(communicationId).run();
    return Response.json({ ok: true });
  }
  for (const suggestionId of ids) {
    const suggestion = await env.DB.prepare("SELECT * FROM communication_suggestions WHERE id=? AND communication_id=? AND status='Suggested'").bind(suggestionId, communicationId).first<Record<string, any>>();
    if (!suggestion) continue;
    if (suggestion.category === "ADDRESS REVIEW") continue;
    if (suggestion.category === "NOTE") {
      await env.DB.prepare("INSERT INTO notes (contact_id,body,source_system,source_record_id,created_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP)").bind(memo.contact_id, suggestion.detail || suggestion.title, sourceSystem, String(communicationId)).run();
    } else if (suggestion.category === "RELATIONSHIP MOMENT") {
      if (!suggestion.due_date || suggestion.needs_review) continue;
      await env.DB.prepare("INSERT INTO relationship_moments (contact_id,type,date_value,label,source_system,source_record_id) VALUES (?,?,?,?,?,?)").bind(memo.contact_id, "Personal milestone", suggestion.due_date, suggestion.title, sourceSystem, String(communicationId)).run();
    } else if (["TASK", "FOLLOW-UP", "APPOINTMENT"].includes(suggestion.category)) {
      if (suggestion.needs_review || (!suggestion.due_date && !((sourceSystem === "sms" || sourceSystem === "email") && suggestion.category === "TASK"))) continue;
      const provenance = [suggestion.commitment ? "Promised by Brad." : "", suggestion.source_excerpt ? `Source: “${suggestion.source_excerpt}”` : "", sourceSystem === "sms" ? `SMS ${memo.occurred_at}; accepted by Brad Claus.` : ""].filter(Boolean).join(" ");
      const created=await env.DB.prepare("INSERT INTO tasks (contact_id,title,type,due_date,due_time,priority,status,notes,source_system,source_record_id,ai_extracted,created_at) VALUES (?,?,?,?,?,'Normal','Open',?,?,?,1,CURRENT_TIMESTAMP)").bind(memo.contact_id, suggestion.title, suggestion.category === "APPOINTMENT" ? "Appointment" : suggestion.category === "FOLLOW-UP" ? "Follow-up" : "Task", suggestion.due_date, suggestion.due_time || null, [suggestion.detail, provenance].filter(Boolean).join(" ") || null, sourceSystem, String(communicationId)).run();
      if(suggestion.category === "APPOINTMENT") await syncAppointment(Number(created.meta.last_row_id));
    } else {
      const fieldName = suggestion.field_name || suggestion.category.toLowerCase().replaceAll(' ', '_');
      if (fieldName === "contact_address") {
        // This path is reached only after Brad explicitly accepts the proposal.
        await env.DB.prepare("UPDATE contacts SET address=?,updated_at=CURRENT_TIMESTAMP,update_source='reviewed_ai',updated_by='Brad Claus' WHERE id=?").bind(suggestion.field_value || null,memo.contact_id).run();
      }
      const sourceDate = (sourceSystem === "sms" || sourceSystem === "email" || sourceSystem === "call") ? memo.occurred_at : new Date().toISOString();
      const latest = await env.DB.prepare("SELECT source_date FROM contact_intelligence WHERE contact_id=? AND field_name=? AND status='Current' ORDER BY source_date DESC LIMIT 1").bind(memo.contact_id, fieldName).first<{source_date:string}>();
      const status = latest?.source_date && latest.source_date > sourceDate ? "Previous" : "Current";
      if (status === "Current") await env.DB.prepare("UPDATE contact_intelligence SET status='Previous' WHERE contact_id=? AND field_name=? AND status='Current' AND COALESCE(source_date,'')<=?").bind(memo.contact_id,fieldName,sourceDate).run();
      await env.DB.prepare("INSERT INTO contact_intelligence (contact_id,category,field_name,value,confidence,source_system,source_record_id,source_date,status) VALUES (?,?,?,?,0.75,?,?,?,?)").bind(memo.contact_id, suggestion.category, fieldName, suggestion.field_value || suggestion.title, sourceSystem, String(communicationId), sourceDate, status).run();
    }
    await env.DB.prepare("UPDATE communication_suggestions SET status='Accepted',accepted_by='Brad Claus',accepted_at=CURRENT_TIMESTAMP WHERE id=?").bind(suggestionId).run();
  }
  return Response.json({ ok: true });
}
