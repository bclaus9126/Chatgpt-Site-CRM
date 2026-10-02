import { env, waitUntil } from "cloudflare:workers";
import { indexPending } from "@/lib/claus-ai/indexer";
import { analyzeEmailThread } from "@/lib/email-analysis";
import { stopContact } from "@/lib/campaign";
import { MAILBOX } from "./graph";

export type GraphMessage = { id:string; internetMessageId?:string; conversationId?:string; subject?:string; body?:{content?:string;contentType?:string}; sentDateTime?:string; receivedDateTime?:string; from?:{emailAddress?:{address?:string;name?:string}}; toRecipients?:{emailAddress?:{address?:string;name?:string}}[]; ccRecipients?:{emailAddress?:{address?:string;name?:string}}[]; hasAttachments?:boolean; attachments?:{name?:string;contentType?:string}[] };
function textBody(mail:GraphMessage) { const body=mail.body?.content || ""; return mail.body?.contentType?.toLowerCase()==="html" ? body.replace(/<br\s*\/?\s*>/gi,"\n").replace(/<\/(?:p|div|li)>/gi,"\n").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").trim() : body; }
export async function ingestMessage(mail:GraphMessage, historical:boolean) {
  if(!mail.id) return 0;
  const sender=mail.from?.emailAddress?.address?.toLowerCase() || "";
  const recipients=[...(mail.toRecipients || []),...(mail.ccRecipients || [])].map(x=>x.emailAddress?.address?.toLowerCase()).filter((x):x is string=>!!x);
  const addresses=[sender,...recipients].filter(x=>x!==MAILBOX);
  if(!addresses.length) return 0;
  const contacts=await env.DB.prepare("SELECT id,first_name,last_name,email FROM contacts").all<Record<string,any>>();
  const methods=await env.DB.prepare("SELECT contact_id,normalized_value FROM contact_methods WHERE kind='email'").all<Record<string,any>>();
  const ids=[...new Set([...contacts.results.filter(c=>addresses.includes(String(c.email||"").trim().toLowerCase())).map(c=>Number(c.id)),...methods.results.filter(m=>addresses.includes(String(m.normalized_value||"").trim().toLowerCase())).map(m=>Number(m.contact_id))])];
  const occurredAt=mail.sentDateTime || mail.receivedDateTime || new Date().toISOString();
  const thread=mail.conversationId || mail.internetMessageId || mail.id;
  const participants=JSON.stringify({sender_name:sender===MAILBOX ? "Brad Claus" : mail.from?.emailAddress?.name || sender,recipient_name:recipients.join(", "),sender,recipients,thread_id:thread,attachments:(mail.attachments||[]).map(a=>({name:a.name,content_type:a.contentType,source_message_id:mail.id,sender,timestamp:occurredAt})),has_attachments:!!mail.hasAttachments});
  let created=0;
  for(const contactId of ids) {
    const sourceId=`microsoft:${contactId}:${mail.id}`;
    if(await env.DB.prepare("SELECT id FROM communications WHERE source_system='microsoft365' AND source_record_id=?").bind(sourceId).first()) continue;
    if(sender===MAILBOX && await env.DB.prepare("SELECT id FROM communications WHERE contact_id=? AND source_record_id LIKE 'campaign:%' AND subject=? AND message_transcript=? AND occurred_at BETWEEN ? AND ? LIMIT 1").bind(contactId,mail.subject||null,textBody(mail),new Date(Date.parse(occurredAt)-600000).toISOString(),new Date(Date.parse(occurredAt)+600000).toISOString()).first()) continue;
    const inserted=await env.DB.prepare("INSERT INTO communications (contact_id,type,direction,occurred_at,subject,message_transcript,author_name,participants,source_system,source_record_id,imported,status) VALUES (?,'Email',?,?,?,?,?,?,?,?,?,'Saved')").bind(contactId,sender===MAILBOX ? "outbound":"inbound",occurredAt,mail.subject||null,textBody(mail),sender,participants,"microsoft365",sourceId,historical?1:0).run();
    created++;
    if(sender!==MAILBOX && !/^(automatic reply|auto:|out of office|autoreply)/i.test(String(mail.subject||'')) && !/auto-submitted/i.test(JSON.stringify(mail))) await stopContact(contactId,'Inbound email reply',occurredAt);
    if(historical) continue;
    if(inserted.meta.last_row_id) waitUntil(indexPending(env.DB,1,false,`communication:${inserted.meta.last_row_id}`).catch(()=>console.error("Microsoft email indexing deferred")));
    const rows=await env.DB.prepare("SELECT id,author_name,participants,message_transcript,occurred_at FROM communications WHERE contact_id=? AND type='Email' ORDER BY occurred_at DESC,id DESC LIMIT 100").bind(contactId).all<Record<string,any>>();
    const group=rows.results.filter(row=>{try{return JSON.parse(row.participants||"{}").thread_id===thread}catch{return false}});
    const messages=group.map(row=>{const p=JSON.parse(row.participants||"{}");return {id:Number(row.id),sender:p.sender_name||row.author_name,recipient:p.recipient_name||"",body:row.message_transcript||"",occurredAt:row.occurred_at}});
    const contact=contacts.results.find(c=>Number(c.id)===contactId);
    const suggestions=analyzeEmailThread(messages,`${contact?.first_name||"Contact"} ${contact?.last_name||""}`);
    for(const row of group) await env.DB.prepare("UPDATE communication_suggestions SET status='Superseded' WHERE communication_id=? AND status='Suggested'").bind(row.id).run();
    for(const item of suggestions) await env.DB.prepare("INSERT INTO communication_suggestions (communication_id,category,title,detail,due_date,due_time,daypart,scheduling_precision,field_name,field_value,commitment,source_excerpt,needs_review) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(item.sourceMessageId,item.category,item.title,item.detail||null,item.dueDate||null,item.dueTime||null,item.daypart||null,item.schedulingPrecision||null,item.fieldName||null,item.fieldValue||null,item.commitment?1:0,item.sourceExcerpt,item.needsReview?1:0).run();
  }
  return created;
}
