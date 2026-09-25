import { waitUntil } from "cloudflare:workers";
import { connection, accessToken, graph, type Connection } from "@/lib/microsoft/graph";
import { ingestMessage, type GraphMessage } from "@/lib/microsoft/ingest";
import { ensureSubscription } from "@/lib/microsoft/sync";
type Notice={subscriptionId?:string;clientState?:string;changeType?:string;resource?:string;resourceData?:{id?:string}};
export async function POST(request:Request) {
  const validation=new URL(request.url).searchParams.get("validationToken");
  if(validation) return new Response(validation,{status:200,headers:{"content-type":"text/plain; charset=utf-8"}});
  const row=await connection(); if(!row?.subscription_id || !row.client_state) return new Response(null,{status:202});
  const body=await request.json().catch(()=>({})) as {value?:Notice[]};
  const valid=(body.value||[]).filter(n=>n.subscriptionId===row.subscription_id && n.clientState===row.client_state && n.changeType==="created");
  if(!valid.length) return new Response(null,{status:202});
  waitUntil((async () => {
    const token=await accessToken(row);
    for(const event of valid.slice(0,20)) {
      const id=event.resourceData?.id || event.resource?.split("/").at(-1);
      if(!id) continue;
      try { const mail=await graph<GraphMessage>(token,`/me/messages/${encodeURIComponent(id)}?$select=id,internetMessageId,conversationId,subject,body,sentDateTime,receivedDateTime,from,toRecipients,ccRecipients,hasAttachments`,{headers:{Prefer:'IdType="ImmutableId", outlook.body-content-type="text"'}});
        if(mail.hasAttachments) { try { const result=await graph<{value:{name:string;contentType:string}[]}>(token,`/me/messages/${encodeURIComponent(id)}/attachments?$select=name,contentType&$top=30`); mail.attachments=result.value; } catch { /* Metadata flag remains. */ } }
        await ingestMessage(mail,false);
      } catch { /* A moved/deleted message will be retried by manual sync. */ }
    }
    await ensureSubscription(row);
  })().catch(() => undefined));
  return new Response(null,{status:202});
}
