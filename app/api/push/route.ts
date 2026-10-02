import { env } from "cloudflare:workers";
import { authorizeCrmOwner } from "@/lib/crm-auth";
import { pushPublicKey } from "@/lib/push";
export const dynamic = "force-dynamic";
type Row = Record<string, any>;
export async function GET() {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  const owner = auth.user.userId;
  const settings = await env.DB.prepare("SELECT * FROM push_settings WHERE owner_user_id=?").bind(owner).first<Row>();
  const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM push_subscriptions WHERE owner_user_id=?").bind(owner).first<Row>();
  return Response.json({publicKey:pushPublicKey(),settings:{inboundSms:settings?.inbound_sms !== 0,unknownSms:settings?.unknown_sms !== 0,preview:settings?.preview !== 0,quietHours:!!settings?.quiet_hours,quietStart:settings?.quiet_start || "22:00",quietEnd:settings?.quiet_end || "07:00"},activeDevices:count?.count || 0},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(request: Request) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  const owner = auth.user.userId;
  let body: Row; try {body = await request.json();} catch {return Response.json({error:"Invalid JSON"},{status:400});}
  if (body.action === "subscribe") {
    const sub = body.subscription;
    if (!sub || typeof sub.endpoint !== "string" || sub.endpoint.length > 2048 || !/^https:\/\//.test(sub.endpoint) || typeof sub.keys?.p256dh !== "string" || typeof sub.keys?.auth !== "string" || sub.keys.p256dh.length > 200 || sub.keys.auth.length > 200 || !pushPublicKey()) return Response.json({error:"Invalid subscription"},{status:400});
    await env.DB.prepare("INSERT INTO push_subscriptions (endpoint,owner_user_id,p256dh,auth,device_name) VALUES (?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET owner_user_id=excluded.owner_user_id,p256dh=excluded.p256dh,auth=excluded.auth,device_name=excluded.device_name,updated_at=CURRENT_TIMESTAMP").bind(sub.endpoint,owner,sub.keys.p256dh,sub.keys.auth,String(body.deviceName || "Browser").slice(0,120)).run();
  } else if (body.action === "unsubscribe") {
    if (typeof body.endpoint !== "string") return Response.json({error:"Invalid endpoint"},{status:400});
    await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint=? AND owner_user_id=?").bind(body.endpoint,owner).run();
  } else if (body.action === "settings") {
    const s = body.settings;
    if (!s || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.quietStart) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.quietEnd)) return Response.json({error:"Invalid quiet hours"},{status:400});
    await env.DB.prepare("INSERT INTO push_settings (owner_user_id,inbound_sms,unknown_sms,preview,quiet_hours,quiet_start,quiet_end) VALUES (?,?,?,?,?,?,?) ON CONFLICT(owner_user_id) DO UPDATE SET inbound_sms=excluded.inbound_sms,unknown_sms=excluded.unknown_sms,preview=excluded.preview,quiet_hours=excluded.quiet_hours,quiet_start=excluded.quiet_start,quiet_end=excluded.quiet_end").bind(owner,Number(!!s.inboundSms),Number(!!s.unknownSms),Number(!!s.preview),Number(!!s.quietHours),s.quietStart,s.quietEnd).run();
  } else return Response.json({error:"Unknown action"},{status:400});
  return GET();
}
