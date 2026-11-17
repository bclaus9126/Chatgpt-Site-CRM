import {env,waitUntil} from 'cloudflare:workers';
import {authorizeCrmOwner} from '@/lib/crm-auth';
import {accessToken,connection,graph} from '@/lib/microsoft/graph';
import {intakeLead} from '@/lib/lead-intake';
import {parseLeadEmail} from '@/lib/lead-normalization';
import {deliverLeadNotifications} from '@/lib/lead-notifications';
export async function POST(){const auth=await authorizeCrmOwner();if(auth.denied)return auth.denied;
 const cfg=env as unknown as Record<string,string>;let rules:Record<string,string>[];try{rules=JSON.parse(cfg.LEAD_EMAIL_RULES||'[]');if(!Array.isArray(rules))throw Error();}catch{return Response.json({error:'LEAD_EMAIL_RULES must be an array of provider/from/subject rules'},{status:503});}
 if(!rules.length)return Response.json({error:'Configure exact approved provider sender and subject rules in LEAD_EMAIL_RULES first. Ordinary emails are never treated as leads.'},{status:503});
 const row=await connection();if(!row)return Response.json({error:'Connect Microsoft first'},{status:503});const token=await accessToken(row);
 const mail=await graph<{value:Record<string,any>[]}>(token,'/me/mailFolders/inbox/messages?$top=50&$orderby=receivedDateTime%20desc&$select=id,from,subject,body,receivedDateTime');let processed=0,failed=0;
 for(const m of mail.value){if(Date.now()-Date.parse(m.receivedDateTime)>24*3600000)continue;const sender=String(m.from?.emailAddress?.address||'').toLowerCase();const rule=rules.find(r=>r.from?.toLowerCase()===sender&&r.subject&&String(m.subject).toLowerCase().includes(r.subject.toLowerCase())&&['zillow','homes','website','facebook','generic'].includes(r.provider));if(!rule)continue;
 const active=await env.DB.prepare('SELECT active FROM lead_sources WHERE provider=?').bind(rule.provider).first<{active:number}>();if(!active?.active)continue;
 const plain=String(m.body?.content||'').replace(/<br\s*\/?\s*>|<\/p>|<\/div>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&');
 try{const result=await intakeLead(rule.provider,{...parseLeadEmail(plain),external_lead_id:`email:${m.id}`,received_at:m.receivedDateTime,source_metadata:{email_id:m.id,sender,subject:m.subject}},{emailFallback:true});if(!result.duplicate){processed++;waitUntil(deliverLeadNotifications(result.id));}}catch{failed++;await env.DB.prepare('UPDATE lead_sources SET last_error=?,last_error_at=CURRENT_TIMESTAMP WHERE provider=?').bind('Lead email did not match parser; review mailbox and adjust provider rule',rule.provider).run();}}
 return Response.json({processed,failed,scanned:mail.value.length,note:'Owner-invoked recent inbox scan. Recurring mailbox polling/provider-specific formats require setup.'});}
