import { env } from "cloudflare:workers";
import { authorizeCrmOwner } from "@/lib/crm-auth";
import { archiveInboundMedia } from "@/lib/telnyx-media";

type Row=Record<string,any>;
export async function POST(request:Request){
  const auth=await authorizeCrmOwner();if(auth.denied)return auth.denied;
  const body=await request.json().catch(()=>({})) as Row;
  if(!Number.isSafeInteger(body.contactId)||body.contactId<=0||(body.communicationId!==undefined&&(!Number.isSafeInteger(body.communicationId)||body.communicationId<=0)))return Response.json({error:"Choose a contact and message."},{status:400});
  const key=(env as unknown as Record<string,string>).TELNYX_API_KEY;
  if(!key)return Response.json({error:"Telnyx messaging is not configured."},{status:503});
  // Bound automatic recovery to recent messages; an explicit retry can target one older record.
  const query=body.communicationId?
    "SELECT id,source_record_id,participants FROM communications WHERE id=? AND contact_id=? AND source_system='telnyx' AND type='SMS' AND direction='inbound'":
    "SELECT id,source_record_id,participants FROM communications WHERE contact_id=? AND source_system='telnyx' AND type='SMS' AND direction='inbound' AND datetime(occurred_at)>=datetime('now','-10 days') ORDER BY occurred_at DESC LIMIT 10";
  const records=(await env.DB.prepare(query).bind(...(body.communicationId?[body.communicationId,body.contactId]:[body.contactId])).all<Row>()).results;
  let checked=0,updated=0,failed=0,attempted=0;
  for(const record of records){
    let participants:Row={};try{participants=JSON.parse(record.participants||"{}");}catch{}
    if(!body.communicationId&&participants.media_checked_at)continue;
    const id=record.source_record_id||participants.telnyx_message_id;
    if(!/^[0-9a-f-]{36}$/i.test(String(id)))continue;
    if(++attempted>3)break;
    try{
      const response=await fetch(`https://api.telnyx.com/v2/messages/${id}`,{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(10000)});
      if(!response.ok){failed++;continue;}
      const result=await response.json() as Row;
      // Do not mark checked if the provider omitted its media field.
      if(!Array.isArray(result.data?.media)){failed++;continue;}
      const archived=await archiveInboundMedia(result.data.media,new URL(request.url).origin,Array.isArray(participants.media)?participants.media:[]);
      await env.DB.prepare("UPDATE communications SET participants=? WHERE id=? AND contact_id=?").bind(JSON.stringify({...participants,...archived,media_pending:false}),record.id,body.contactId).run();
      checked++;if(archived.media.length||archived.media_failures.length)updated++;
      if(archived.media_failures.length)failed++;
    }catch{failed++;}
  }
  return Response.json({checked,updated,failed},{headers:{"Cache-Control":"no-store"}});
}
