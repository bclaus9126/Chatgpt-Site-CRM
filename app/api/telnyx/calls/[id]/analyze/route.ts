import { authorizeCrmOwner } from "@/lib/crm-auth";
import { env } from "cloudflare:workers";
import { saveCallAnalysis } from "@/lib/call-analysis";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  const id = Number((await params).id);
  const call = await env.DB.prepare(`SELECT c.id,c.occurred_at,c.message_transcript,TRIM(COALESCE(ct.first_name,'') || ' ' || COALESCE(ct.last_name,'')) contact_name,
    f.brad_call_control_id,f.contact_call_control_id
    FROM communications c LEFT JOIN contacts ct ON ct.id=c.contact_id LEFT JOIN telnyx_call_flows f ON f.communication_id=c.id
    WHERE c.id=? AND c.type='Call'`).bind(id).first<Record<string, any>>();
  if (!call?.message_transcript) return Response.json({ error: "Transcript not available" }, { status: 409 });
  // Channel order is not reliably implied by transcript wording or call direction.
  // Without a persisted recording-leg/channel association, leave labels unresolved.
  const recordingRole = null;
  const result = await saveCallAnalysis(env.DB, id, { transcript: call.message_transcript, contactName: call.contact_name || "Contact", occurredAt: call.occurred_at, recordingRole });
  return Response.json({ ok: true, summary: result.summary, suggestions: result.suggestions.length });
}
