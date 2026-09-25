import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { CALLBACK, configured, connection, exchange, graph, MAILBOX, ORIGIN, seal, SEND_SCOPE } from "@/lib/microsoft/graph";
import { ensureSubscription, syncMail } from "@/lib/microsoft/sync";
import { syncAppointment } from "@/lib/microsoft/calendar";
const done=(message:string)=>Response.redirect(`${ORIGIN}/?microsoft=${encodeURIComponent(message)}`,303);
export async function GET(request:Request) {
  if(!configured()) return done("configuration-needed");
  const url=new URL(request.url),state=url.searchParams.get("state"),code=url.searchParams.get("code");
  if(!state||!code||url.searchParams.has("error")) return done("authorization-cancelled");
  const cookie=(await cookies()).get("claus_ms_state")?.value;
  if(cookie!==state) return done("authorization-expired");
  const record=await env.DB.prepare("DELETE FROM microsoft_oauth_states WHERE state=? AND expires_at>? RETURNING owner_user_id,verifier").bind(state,new Date().toISOString()).first<{owner_user_id:string;verifier:string}>();
  if(!record) return done("authorization-expired");
  const user=await getChatGPTUser();
  if(user && user.userId!==record.owner_user_id) return done("account-mismatch");
  try {
    const tokens=await exchange({grant_type:"authorization_code",code,redirect_uri:CALLBACK,code_verifier:record.verifier,scope:SEND_SCOPE});
    if(!tokens.refresh_token) return done("offline-access-needed");
    const me=await graph<{id:string;mail?:string;userPrincipalName?:string}>(tokens.access_token,"/me?$select=id,mail,userPrincipalName");
    const addresses=[me.mail,me.userPrincipalName].map(x=>x?.toLowerCase());
    if(!addresses.includes(MAILBOX)) return done("wrong-mailbox");
    const existing=await connection(); if(existing && existing.owner_user_id!==record.owner_user_id) return done("already-connected");
    const sendEnabled=!!tokens.scope?.split(/\s+/).some(scope=>scope.toLowerCase()==="mail.send");
    const calendarEnabled=!!tokens.scope?.split(/\s+/).some(scope=>scope.toLowerCase()==="calendars.readwrite");
    await env.DB.prepare(`INSERT INTO microsoft_mail_connections (owner_user_id,mailbox,graph_user_id,encrypted_refresh_token,send_enabled,calendar_enabled) VALUES (?,?,?,?,?,?) ON CONFLICT(mailbox) DO UPDATE SET graph_user_id=excluded.graph_user_id,encrypted_refresh_token=excluded.encrypted_refresh_token,send_enabled=excluded.send_enabled,calendar_enabled=excluded.calendar_enabled,updated_at=CURRENT_TIMESTAMP`).bind(record.owner_user_id,MAILBOX,me.id,await seal(tokens.refresh_token),sendEnabled?1:0,calendarEnabled?1:0).run();
    const row=await connection(); if(!row) return done("connection-error");
    if(calendarEnabled) { const pending=(await env.DB.prepare("SELECT id FROM tasks WHERE type='Appointment' AND calendar_sync_status='failed' AND due_time IS NOT NULL ORDER BY id DESC LIMIT 20").all<{id:number}>()).results; for(const a of pending) await syncAppointment(a.id); }
    try { await ensureSubscription(row); } catch { /* Manual sync remains available if notifications cannot be registered. */ }
    try { await syncMail(row,true); } catch { return done("connected-sync-pending"); }
    return done("connected");
  } catch { return done("connection-error"); }
}
