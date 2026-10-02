import { authorizeCrmOwner } from "@/lib/crm-auth";
import { env } from "cloudflare:workers";
import { BUSINESS_NUMBER, normalizePhone } from "@/lib/telnyx-call-control";
import { isStoredImageUrl } from "@/lib/telnyx-media";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  const id = new URL(request.url).searchParams.get("messageId") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({error:"Invalid message ID."},{status:400});
  const record = await env.DB.prepare("SELECT id FROM communications WHERE external_provider_id=? AND source_system='telnyx' AND type='SMS'").bind(`telnyx-sms:${id}`).first();
  if (!record) return Response.json({error:"Message not found."},{status:404});
  const apiKey = (env as unknown as {TELNYX_API_KEY?:string}).TELNYX_API_KEY;
  if (!apiKey) return Response.json({error:"Telnyx is not configured."},{status:503});
  const response = await fetch(`https://api.telnyx.com/v2/messages/${id}`,{headers:{Authorization:`Bearer ${apiKey}`}});
  const result = await response.json().catch(() => ({})) as Record<string,any>;
  if (!response.ok) return Response.json({error:`Could not retrieve delivery details (HTTP ${response.status}).`},{status:502});
  const p = result.data || {}, recipient = Array.isArray(p.to) ? p.to[0] || {} : {};
  const status = String(recipient.status || p.status || "Unknown").slice(0,80);
  const errors = [...(Array.isArray(recipient.errors) ? recipient.errors : []),...(Array.isArray(p.errors) ? p.errors : [])];
  const reason = errors.map((e: Record<string,any>) => [e.code,e.title || e.detail].filter(Boolean).join(": ")).filter(Boolean).join("; ").slice(0,500);
  await env.DB.prepare("UPDATE communications SET status=?,subject=? WHERE external_provider_id=? AND source_system='telnyx' AND type='SMS'").bind(status,reason || null,`telnyx-sms:${id}`).run();
  return Response.json({status,reason});
}

export async function POST(request: Request) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  const body = await request.json().catch(() => ({})) as {contactId?:number;text?:string;idempotencyKey?:string;mediaUrl?:string};
  const text = String(body.text || "").trim(), key = String(body.idempotencyKey || ""), mediaUrl = String(body.mediaUrl || "");
  if (!Number.isSafeInteger(body.contactId) || (!text && !mediaUrl) || text.length > 1600 || !/^[0-9a-f-]{36}$/i.test(key) || (mediaUrl && !(await isStoredImageUrl(mediaUrl,new URL(request.url).origin))))
    return Response.json({error:"Choose a contact and enter a message under 1,600 characters or attach an image."},{status:400});
  const contact = await env.DB.prepare("SELECT id,phone,first_name,last_name FROM contacts WHERE id=?").bind(body.contactId).first<Record<string,any>>();
  const to = normalizePhone(contact?.phone);
  if (!contact || !to || !BUSINESS_NUMBER) return Response.json({error:"This contact needs a valid phone number."},{status:400});
  const claim = await env.DB.prepare("INSERT INTO telnyx_events (event_id,event_type,from_number,to_number,direction,payload) VALUES (?,'sms.send.request',?,?,'outbound',?) ON CONFLICT(event_id) DO NOTHING")
    .bind(`sms-send:${key}`,BUSINESS_NUMBER,to,JSON.stringify({contact_id:contact.id})).run();
  if (!claim.meta.changes) return Response.json({error:"This send request has already been submitted."},{status:409});
  const apiKey = (env as unknown as {TELNYX_API_KEY?:string}).TELNYX_API_KEY;
  if (!apiKey) return Response.json({error:"Telnyx messaging is not configured."},{status:503});
  let response: Response;
  try { response = await fetch("https://api.telnyx.com/v2/messages",{
    method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},
    body:JSON.stringify({from:BUSINESS_NUMBER,to,text, ...(mediaUrl ? {media_urls:[mediaUrl]} : {})}),
  }); } catch { return Response.json({error:"Telnyx could not accept the message. Check delivery before retrying."},{status:503}); }
  const result = await response.json().catch(() => ({})) as Record<string,any>;
  if (!response.ok || !result.data?.id) {
    console.error("Telnyx SMS send failed",{status:response.status,code:result.errors?.[0]?.code});
    return Response.json({error:`Telnyx rejected the message (HTTP ${response.status}).`},{status:502});
  }
  const p = result.data, occurredAt = p.sent_at || new Date().toISOString();
  await env.DB.prepare(`INSERT INTO communications (contact_id,type,direction,occurred_at,message_transcript,status,source_system,source_record_id,external_provider_id,from_number,to_number,imported,author_name,participants)
    VALUES (?,'SMS','outbound',?,?,?,?,?,?,?,?,0,'Brad Claus',?) ON CONFLICT(external_provider_id) DO NOTHING`)
    .bind(contact.id,occurredAt,text,String(p.to?.[0]?.status || "Sent"),"telnyx",String(p.id),`telnyx-sms:${p.id}`,BUSINESS_NUMBER,to,JSON.stringify({sender_name:"Brad Claus",recipient_name:`${contact.first_name} ${contact.last_name}`,from:BUSINESS_NUMBER,to,telnyx_message_id:p.id,media:mediaUrl ? [{url:mediaUrl}] : []})).run();
  return Response.json({ok:true,messageId:p.id});
}
