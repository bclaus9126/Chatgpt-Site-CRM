import { env } from 'cloudflare:workers';
import webpush from 'web-push';
import { pushConfiguration } from './push';
import { accessToken,connection,graph } from './microsoft/graph';
import { BUSINESS_NUMBER,BRAD_CELL,normalizePhone } from './telnyx-call-control';
type Row=Record<string,any>;
export async function deliverLeadNotifications(intakeId?:number) {
 const jobs=await env.DB.prepare(`SELECT d.*,l.contact_id,l.source,l.property,l.message,l.processing_status,l.is_test,c.first_name,c.last_name FROM lead_notification_deliveries d JOIN lead_intakes l ON l.id=d.intake_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE d.status='scheduled' ${intakeId?'AND l.id=?':''} ORDER BY d.id LIMIT 30`).bind(...(intakeId?[intakeId]:[])).all<Row>();
 for(const job of jobs.results) {
  const claim=await env.DB.prepare("UPDATE lead_notification_deliveries SET status='processing',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='scheduled'").bind(job.id).run();if(!claim.meta.changes)continue;
  const cfg=env as unknown as Record<string,string>;const url=`https://claus-crm.bclaus.chatgpt.site/${job.contact_id?`?contact=${job.contact_id}`:'?leads=review'}`;
  const title=`${job.is_test?"TEST — ":""}New ${job.source} Lead`;const body=[`${job.first_name||'Contact needs review'} ${job.last_name||''}`.trim(),job.property,job.message?.replace(/\s+/g,' ').slice(0,100),url].filter(Boolean).join('\n');
  let attempted=false;
  try {
   let providerId:string|null=null;
   if(job.channel==='sms') {
    const to=normalizePhone(BRAD_CELL);if(!to||!BUSINESS_NUMBER||!cfg.TELNYX_API_KEY)throw Error('Owner SMS notification configuration missing');
    attempted=true;const r=await fetch('https://api.telnyx.com/v2/messages',{method:'POST',headers:{Authorization:`Bearer ${cfg.TELNYX_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({from:BUSINESS_NUMBER,to,text:`${title}\n${body}`.slice(0,900)}),signal:AbortSignal.timeout(12000)});
    const result=await r.json() as Row;if(!r.ok){attempted=false;throw Error(`Telnyx ${r.status}; code ${result.errors?.[0]?.code||'unknown'}${String(result.errors?.[0]?.code)==='40300'?'; blocked after STOP — send START from your cell to the original business number you opted out from':''}`);}providerId=result.data?.id||null;
   } else if(job.channel==='email') {
    const row=await connection();const to=String(cfg.CRM_OWNER_EMAIL||'').trim();if(!row?.send_enabled||row.mailbox.toLowerCase()!==to.toLowerCase())throw Error('Owner Microsoft mailbox requires Mail.Send');
    const token=await accessToken(row);attempted=true;await graph(token,'/me/sendMail',{method:'POST',signal:AbortSignal.timeout(12000),body:JSON.stringify({message:{subject:title,body:{contentType:'Text',content:body},toRecipients:[{emailAddress:{address:to}}]},saveToSentItems:true})});
   } else {
    if(!pushConfiguration().ready)throw Error('Push configuration missing');
    const sub=await env.DB.prepare('SELECT * FROM push_subscriptions WHERE endpoint=?').bind(job.device_key).first<Row>();if(!sub)throw Error('Push device expired');
    const owner=await connection();if(!owner||owner.mailbox.toLowerCase()!==String(cfg.CRM_OWNER_EMAIL||'').toLowerCase()||sub.owner_user_id!==owner.owner_user_id)throw Error('Push owner mismatch');
    attempted=true;await webpush.sendNotification({endpoint:sub.endpoint,keys:{auth:sub.auth,p256dh:sub.p256dh}},JSON.stringify({title,body:body.split('\n').slice(0,3).join(' · '),url,tag:`lead-${job.intake_id}`}),{TTL:3600,urgency:'high',timeout:12000});
   }
   await env.DB.prepare("UPDATE lead_notification_deliveries SET status='sent',provider_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(providerId,job.id).run();
  } catch(e) {
   const code=Number((e as any)?.statusCode||0);if(job.channel==='push'&&[404,410].includes(code))await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').bind(job.device_key).run();
   const reason=job.channel==='push'?code?`Push provider ${code}`:!attempted&&e instanceof Error&&/^Push (configuration|device|owner)/.test(e.message)?e.message:'Push network/delivery failure':e instanceof Error&&/^(Owner |Telnyx \d|Microsoft Graph \d)/.test(e.message)?e.message:'Notification delivery failed';
   await env.DB.prepare("UPDATE lead_notification_deliveries SET status=?,error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(attempted?'unknown':'failed',reason.slice(0,300),job.id).run();
  }
 }
 // A crashed send is uncertain; never blindly re-send it and risk duplicate alerts.
 await env.DB.prepare("UPDATE lead_notification_deliveries SET status='unknown',error='Delivery interrupted; check provider before retry',updated_at=CURRENT_TIMESTAMP WHERE status='processing' AND updated_at<datetime('now','-5 minutes')").run();
}
export async function queueLeadNotifications(id:number) {
 await env.DB.batch(['sms','email'].map(channel=>env.DB.prepare("INSERT INTO lead_notification_deliveries(intake_id,channel) VALUES (?,?) ON CONFLICT DO NOTHING").bind(id,channel)));
 const owner=await connection();
 const cfg=env as unknown as Record<string,string>;
 const devices=owner&&owner.mailbox.toLowerCase()===String(cfg.CRM_OWNER_EMAIL||'').toLowerCase()?await env.DB.prepare('SELECT endpoint FROM push_subscriptions WHERE owner_user_id=?').bind(owner.owner_user_id).all<Row>():{results:[] as Row[]};
 if(devices.results.length)await env.DB.batch(devices.results.map(s=>env.DB.prepare("INSERT INTO lead_notification_deliveries(intake_id,channel,device_key) VALUES (?,'push',?) ON CONFLICT DO NOTHING").bind(id,s.endpoint)));
}
