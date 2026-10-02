import { env } from "cloudflare:workers";
import { BRAD_CELL, BUSINESS_NUMBER, normalizePhone } from "./telnyx-call-control";

type Row = Record<string, any>;
const clean = (value: unknown, max = 95) => String(value || "").replace(/[\r\n]+/g," ").replace(/\s+/g," ").trim().slice(0,max);
export async function callNoticeText(db: D1Database, caller: string, matches: {id:number;first_name:string;last_name:string}[], includeUnknown = true) {
  if (matches.length > 1) return `Incoming Claus CRM call\nPossible matches: ${matches.slice(0,3).map(c => clean(`${c.first_name} ${c.last_name}`,50)).join(", ")}\n${caller}`;
  if (!matches.length) return includeUnknown ? `Incoming Claus CRM call\nUnknown caller\n${caller}` : null;
  const c = await db.prepare("SELECT id,first_name,last_name,relationship,intent,stage,property_address,last_meaningful_contact FROM contacts WHERE id=?").bind(matches[0].id).first<Row>();
  if (!c) return null;
  const facts = [clean([c.relationship,c.intent,c.stage].filter(Boolean).join(" · "),120)];
  const opportunity = await db.prepare("SELECT type,stage FROM opportunities WHERE contact_id=? AND lower(stage) NOT LIKE '%clos%' ORDER BY updated_at DESC LIMIT 1").bind(c.id).first<Row>();
  if (opportunity) facts.push(`Opportunity: ${clean([opportunity.type,opportunity.stage].filter(Boolean).join(" · "))}`);
  const appointment = await db.prepare("SELECT title,due_date,due_time FROM tasks WHERE contact_id=? AND type='Appointment' AND status<>'Completed' AND due_date>=date('now') ORDER BY due_date LIMIT 1").bind(c.id).first<Row>();
  if (appointment) facts.push(`Next: ${clean(appointment.title,55)} · ${appointment.due_date}${appointment.due_time ? " "+appointment.due_time : ""}`);
  const commitment = await db.prepare("SELECT s.title FROM communication_suggestions s JOIN communications m ON m.id=s.communication_id WHERE m.contact_id=? AND s.commitment=1 AND s.status='Accepted' ORDER BY s.due_date DESC LIMIT 1").bind(c.id).first<Row>();
  if (commitment) facts.push(`Open item: ${clean(commitment.title,85)}`);
  if (facts.length < 3 && c.property_address) facts.push(`Property: ${clean(c.property_address,65)}`);
  if (facts.length < 3 && c.last_meaningful_contact) facts.push(`Last contact: ${clean(c.last_meaningful_contact,30)}`);
  return [`Incoming call: ${clean(`${c.first_name} ${c.last_name}`,55)}`,...facts.filter(Boolean).slice(0,3)].join("\n").slice(0,440);
}

export async function sendCallNotice(db: D1Database, flowId: string, sessionId: string, caller: string, matches: {id:number;first_name:string;last_name:string}[]) {
  const settings = env as unknown as Record<string,string | undefined>;
  if (settings.INBOUND_CALL_CONTEXT_SMS_ENABLED !== "true") return;
  const override = await db.prepare("SELECT payload FROM telnyx_events WHERE event_id='call-notice-settings'").first<{payload:string}>();
  if (override && JSON.parse(override.payload).enabled === false) return;
  const to = normalizePhone(settings.INBOUND_CALL_CONTEXT_SMS_TO || BRAD_CELL);
  if (!to || !BUSINESS_NUMBER || !settings.TELNYX_API_KEY) return;
  const text = await callNoticeText(db,caller,matches,settings.INBOUND_CALL_CONTEXT_UNKNOWN !== "false");
  if (!text) return;
  const claimed = await db.prepare("INSERT INTO telnyx_events (event_id,event_type,call_session_id,from_number,to_number,direction,payload) VALUES (?,'internal_notification',?,?,?,'outbound',?) ON CONFLICT(event_id) DO NOTHING")
    .bind(`call-notice:${sessionId}`,sessionId,BUSINESS_NUMBER,to,JSON.stringify({flow_id:flowId,status:"attempted",match_count:matches.length})).run();
  if (!claimed.meta.changes) return;
  try {
    const response = await fetch("https://api.telnyx.com/v2/messages",{method:"POST",headers:{Authorization:`Bearer ${settings.TELNYX_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:BUSINESS_NUMBER,to,text})});
    const result = await response.json().catch(()=>({})) as Row;
    await db.prepare("UPDATE telnyx_events SET payload=? WHERE event_id=?").bind(JSON.stringify({flow_id:flowId,status:response.ok ? "sent" : "failed",http_status:response.status,message_id:result.data?.id || null,match_count:matches.length}),`call-notice:${sessionId}`).run();
    if (!response.ok) console.error("Call notice SMS rejected",{flowId,status:response.status,code:result.errors?.[0]?.code});
  } catch { console.error("Call notice SMS could not be sent",{flowId}); }
}
