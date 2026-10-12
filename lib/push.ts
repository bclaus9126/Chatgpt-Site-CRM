import { env } from "cloudflare:workers";
import webpush from "web-push";

type Row = Record<string, any>;
export function pushConfiguration() {
  const e = env as unknown as Record<string,string>;
  const missing = ["VAPID_PUBLIC_KEY","VAPID_PRIVATE_KEY","CRM_OWNER_EMAIL"].filter(key => !e[key]);
  if (missing.length) return {ready:false,missing,error:"Missing configuration"};
  try { webpush.setVapidDetails(`mailto:${e.CRM_OWNER_EMAIL}`,e.VAPID_PUBLIC_KEY,e.VAPID_PRIVATE_KEY); return {ready:true,missing,error:null}; }
  catch { return {ready:false,missing,error:"Invalid VAPID configuration"}; }
}
export function pushPublicKey() { return (env as unknown as Record<string,string>).VAPID_PUBLIC_KEY || ""; }
function inQuietHours(settings: Row) {
  if (!settings.quiet_hours) return false;
  const time = new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date());
  const start = settings.quiet_start, end = settings.quiet_end;
  return start < end ? time >= start && time < end : time >= start || time < end;
}
export async function notifyInboundSms(id: number, contact: Row | null, phone: string, message: string, origin: string) {
  console.info("SMS push trigger",{communicationId:id});
  if (!pushConfiguration().ready) { console.warn("SMS push suppressed",{communicationId:id,reason:"configuration"}); return; }
  const settings = await env.DB.prepare("SELECT * FROM push_settings LIMIT 1").first<Row>();
  if (settings && (!settings.inbound_sms || (!contact && !settings.unknown_sms) || inQuietHours(settings))) { console.info("SMS push suppressed",{communicationId:id,reason:!settings.inbound_sms ? "inbound_sms_off" : !contact && !settings.unknown_sms ? "unknown_numbers_off" : "quiet_hours"}); return; }
  const subscriptions = await env.DB.prepare("SELECT * FROM push_subscriptions").all<Row>();
  if (!subscriptions.results.length) console.info("SMS push suppressed",{communicationId:id,reason:"no_subscriptions"});
  const name = contact ? `${contact.first_name} ${contact.last_name}`.trim() : phone;
  const url = contact ? `/?sms_contact=${contact.id}&sms_message=${id}` : `/?unmatched_sms=${id}`;
  const payload = JSON.stringify({title:`New text from ${name}`,body:settings?.preview === 0 ? "New message received" : (message.trim().replace(/\s+/g," ").slice(0,110) || "Image received"),url,tag:`sms-${id}`});
  console.info("SMS push payload prepared",{communicationId:id,devices:subscriptions.results.length,contactMatched:!!contact});
  await Promise.allSettled(subscriptions.results.map(async sub => {
    // Unique delivery claim is durable across Telnyx retries and concurrent webhook executions.
    const claim = await env.DB.prepare("INSERT INTO push_deliveries (communication_id,endpoint,type,status) VALUES (?,?,'inbound_sms','sending') ON CONFLICT DO NOTHING").bind(id,sub.endpoint).run();
    if (!claim.meta.changes) {console.info("SMS push duplicate skipped",{communicationId:id});return;}
    try {
      const endpoint = new URL(sub.endpoint);
      if (endpoint.protocol !== "https:") throw Error("Invalid push endpoint");
      await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},payload,{TTL:300,urgency:"high"});
      await env.DB.prepare("UPDATE push_subscriptions SET updated_at=CURRENT_TIMESTAMP WHERE endpoint=?").bind(sub.endpoint).run();
      console.info("SMS push provider accepted",{communicationId:id});
      await env.DB.prepare("UPDATE push_deliveries SET status='sent' WHERE communication_id=? AND endpoint=?").bind(id,sub.endpoint).run();
    } catch (error) {
      const status = Number((error as {statusCode?:number}).statusCode || 0);
      await env.DB.prepare("UPDATE push_deliveries SET status=? WHERE communication_id=? AND endpoint=?").bind(status ? `failed:${status}` : "failed",id,sub.endpoint).run();
      if (status === 404 || status === 410) await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint=?").bind(sub.endpoint).run();
      console.error("Push delivery failed",{communicationId:id,status:status||null,reason:status ? `provider_http_${status}` : error instanceof Error ? error.name : "unknown"});
    }
  }));
}

// Owner-authenticated diagnostic only; never creates a communication or runs AI.
export async function sendTestPush(owner: string) {
  const configuration = pushConfiguration();
  if (!configuration.ready) return {attempted:0,accepted:0,failed:0,error:configuration.error,missing:configuration.missing};
  const subscriptions = await env.DB.prepare("SELECT * FROM push_subscriptions WHERE owner_user_id=?").bind(owner).all<Row>();
  const results = await Promise.all(subscriptions.results.map(async sub => {
    try {
      await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},JSON.stringify({title:"Claus CRM Test",body:"Push notifications are working.",url:"/",tag:`test-${crypto.randomUUID()}`}),{TTL:300,urgency:"high"});
      await env.DB.prepare("UPDATE push_subscriptions SET updated_at=CURRENT_TIMESTAMP WHERE endpoint=? AND owner_user_id=?").bind(sub.endpoint,owner).run();
      return {accepted:true};
    } catch (error) {
      const status = Number((error as {statusCode?:number}).statusCode||0);
      if (status===404 || status===410) await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint=? AND owner_user_id=?").bind(sub.endpoint,owner).run();
      const reason = status ? `provider_http_${status}` : error instanceof Error ? error.name : "unknown";
      console.error("Test push failed",{status:status||null,reason});
      return {accepted:false,reason};
    }
  }));
  return {attempted:results.length,accepted:results.filter(r=>r.accepted).length,failed:results.filter(r=>!r.accepted).length,errors:results.filter(r=>!r.accepted).map(r=>r.reason)};
}
