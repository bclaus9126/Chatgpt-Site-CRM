import { env } from "cloudflare:workers";
import { accessToken, connection, graph, random, ORIGIN, type Connection } from "./graph";
import { ingestMessage, type GraphMessage } from "./ingest";

type Page = { value: GraphMessage[]; "@odata.nextLink"?:string };
export async function syncMail(row:Connection, baseline=false) {
  const token=await accessToken(row);
  const since=new Date(baseline ? Date.now()-30*86400000 : Date.parse(row.last_synced_at || new Date(Date.now()-86400000).toISOString())-5*60000).toISOString();
  const paths=[`/me/mailFolders/inbox/messages?$orderby=receivedDateTime%20desc&$top=50&$select=id,internetMessageId,conversationId,subject,body,sentDateTime,receivedDateTime,from,toRecipients,ccRecipients,hasAttachments`, `/me/mailFolders/sentitems/messages?$orderby=sentDateTime%20desc&$top=50&$select=id,internetMessageId,conversationId,subject,body,sentDateTime,receivedDateTime,from,toRecipients,ccRecipients,hasAttachments`];
  let imported=0, scanned=0, truncated=false;
  for(let path of paths) {
    while(path && scanned<100) {
      const page=await graph<Page>(token,path,{headers:{Prefer:'IdType="ImmutableId", outlook.body-content-type="text"'}});
      let reachedOlderMail=false;
      for(const mail of page.value||[]) {
        const timestamp=Date.parse(mail.sentDateTime || mail.receivedDateTime || "");
        if(Number.isFinite(timestamp) && timestamp<Date.parse(since)) { reachedOlderMail=true; continue; }
        scanned++;
        if(mail.hasAttachments) {
          try { const attachments=await graph<{value:{name:string;contentType:string}[]}>(token,`/me/messages/${encodeURIComponent(mail.id)}/attachments?$select=name,contentType&$top=30`); mail.attachments=attachments.value; } catch { /* Preserve has_attachments flag when metadata fetch fails. */ }
        }
        imported+=await ingestMessage(mail,baseline || (Number.isFinite(timestamp) && timestamp<Date.now()-7*86400000));
        if(scanned>=100) break;
      }
      path=reachedOlderMail ? "" : page["@odata.nextLink"]||"";
    }
    if(path) truncated=true;
  }
  await env.DB.prepare("UPDATE microsoft_mail_connections SET last_synced_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(new Date().toISOString(),row.id).run();
  return {imported,scanned,truncated};
}
export async function ensureSubscription(row:Connection) {
  if(row.subscription_expires_at && Date.parse(row.subscription_expires_at)>Date.now()+2*86400000) return;
  const token=await accessToken(row);
  const expires=new Date(Date.now()+6*86400000).toISOString();
  if(row.subscription_id) {
    try { const renewed=await graph<{expirationDateTime:string}>(token,`/subscriptions/${encodeURIComponent(row.subscription_id)}`,{method:"PATCH",body:JSON.stringify({expirationDateTime:expires})}); await env.DB.prepare("UPDATE microsoft_mail_connections SET subscription_expires_at=? WHERE id=?").bind(renewed.expirationDateTime,row.id).run(); return; } catch { /* Removed or expired subscription: replace it. */ }
  }
  const state=random(32);
  const subscription=await graph<{id:string;expirationDateTime:string}>(token,"/subscriptions",{method:"POST",body:JSON.stringify({changeType:"created",notificationUrl:`${ORIGIN}/api/microsoft/notifications`,resource:"/me/messages",expirationDateTime:expires,clientState:state})});
  await env.DB.prepare("UPDATE microsoft_mail_connections SET subscription_id=?,client_state=?,subscription_expires_at=? WHERE id=?").bind(subscription.id,state,subscription.expirationDateTime,row.id).run();
}
export async function syncConnected() { const row=await connection(); if(!row) throw Error("Connect Microsoft 365 first"); await ensureSubscription(row); return syncMail(row); }
