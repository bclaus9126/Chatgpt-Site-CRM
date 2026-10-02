import { env } from "cloudflare:workers";
import webpush from "web-push";

type Row = Record<string, any>;
function configured() {
  const e = env as unknown as Record<string,string>;
  if (!e.VAPID_PUBLIC_KEY || !e.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(`mailto:${e.CRM_OWNER_EMAIL}`,e.VAPID_PUBLIC_KEY,e.VAPID_PRIVATE_KEY);
  return true;
}
export function pushPublicKey() { return (env as unknown as Record<string,string>).VAPID_PUBLIC_KEY || ""; }
function inQuietHours(settings: Row) {
  if (!settings.quiet_hours) return false;
  const time = new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date());
  const start = settings.quiet_start, end = settings.quiet_end;
  return start < end ? time >= start && time < end : time >= start || time < end;
}
export async function notifyInboundSms(id: number, contact: Row | null, phone: string, message: string, origin: string) {
  if (!configured()) return;
  const settings = await env.DB.prepare("SELECT * FROM push_settings LIMIT 1").first<Row>();
  if (settings && (!settings.inbound_sms || (!contact && !settings.unknown_sms) || inQuietHours(settings))) return;
  const subscriptions = await env.DB.prepare("SELECT * FROM push_subscriptions").all<Row>();
  const name = contact ? `${contact.first_name} ${contact.last_name}`.trim() : phone;
  const url = contact ? `/?sms_contact=${contact.id}&sms_message=${id}` : `/?unmatched_sms=${id}`;
  const payload = JSON.stringify({title:`New text from ${name}`,body:settings?.preview === 0 ? "New message received" : (message.trim().replace(/\s+/g," ").slice(0,110) || "Image received"),url,tag:`sms-${id}`});
  await Promise.allSettled(subscriptions.results.map(async sub => {
    // Unique delivery claim is durable across Telnyx retries and concurrent webhook executions.
    const claim = await env.DB.prepare("INSERT INTO push_deliveries (communication_id,endpoint,type,status) VALUES (?,?,'inbound_sms','sending') ON CONFLICT DO NOTHING").bind(id,sub.endpoint).run();
    if (!claim.meta.changes) return;
    try {
      const endpoint = new URL(sub.endpoint);
      if (endpoint.protocol !== "https:") throw Error("Invalid push endpoint");
      await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},payload,{TTL:300,urgency:"high"});
      await env.DB.prepare("UPDATE push_deliveries SET status='sent' WHERE communication_id=? AND endpoint=?").bind(id,sub.endpoint).run();
    } catch (error) {
      const status = Number((error as {statusCode?:number}).statusCode || 0);
      await env.DB.prepare("UPDATE push_deliveries SET status=? WHERE communication_id=? AND endpoint=?").bind(status ? `failed:${status}` : "failed",id,sub.endpoint).run();
      if (status === 404 || status === 410) await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint=?").bind(sub.endpoint).run();
      console.error("Push delivery failed",status || (error instanceof Error ? error.name : "unknown"));
    }
  }));
}
