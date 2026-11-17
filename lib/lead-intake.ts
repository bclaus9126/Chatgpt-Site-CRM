import {env} from 'cloudflare:workers';
import {normalizeLead,leadPhone,type Lead} from './lead-normalization';
import {queueLeadNotifications} from './lead-notifications';
import {enroll} from './campaign';
export async function intakeLead(provider:string,input:Lead,options:{test?:boolean;historical?:boolean;emailFallback?:boolean}={}) {
 const lead=normalizeLead(provider,input);const db=env.DB;const lock=crypto.randomUUID();
 const claimed=await db.prepare("INSERT INTO lead_intake_lock(id,owner,expires_at) VALUES(1,?,datetime('now','+2 minutes')) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at WHERE expires_at<datetime('now')").bind(lock).run();
 if(!claimed.meta.changes)throw Error('Intake busy; retry with the same external_lead_id');
 try {
  const duplicate=await db.prepare('SELECT id,contact_id,processing_status,is_test,live FROM lead_intakes WHERE provider=? AND external_lead_id=?').bind(provider,lead.external_lead_id).first<Lead>();
  if(duplicate&&['processed','needs_review','test'].includes(duplicate.processing_status)){if(duplicate.live&&!duplicate.is_test)await queueLeadNotifications(duplicate.id);return {...duplicate,duplicate:true};}
  const id=duplicate?.id||Number((await db.prepare('INSERT INTO lead_intakes(provider,external_lead_id,source,subtype,campaign,property,message,notes,received_at,raw_payload,metadata,live,is_test) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(provider,lead.external_lead_id,lead.source,lead.subtype,lead.campaign,lead.property,lead.message,lead.notes,lead.received_at,JSON.stringify(lead.raw_payload),JSON.stringify(lead.metadata),Number(!options.historical),Number(!!options.test)).run()).meta.last_row_id);
  if(options.test){await db.prepare("UPDATE lead_intakes SET processing_status='test',dedupe_result='TEST LEAD; no contact, campaign or notifications' WHERE id=?").bind(id).run();return {id,contact_id:null,processing_status:'test'};}
  const contacts=(await db.prepare('SELECT id,phone,email,additional_phones,additional_emails FROM contacts').all<Lead>()).results;
  const matches=contacts.filter(c=>lead.phone&&[c.phone,...String(c.additional_phones||'').split('\n').map(x=>x.split('|')[0])].some(x=>leadPhone(x)===lead.phone)||lead.email&&[c.email,...String(c.additional_emails||'').split('\n').map(x=>x.split('|')[0])].some(x=>String(x||'').trim().toLowerCase()===lead.email));
  if(matches.length>1){await db.prepare("UPDATE lead_intakes SET processing_status='needs_review',dedupe_result='Conflicting phone/email matches; no merge performed' WHERE id=?").bind(id).run();if(!options.historical)await queueLeadNotifications(id);return{id,contact_id:null,processing_status:'needs_review'};}
  let contactId=duplicate?.contact_id||matches[0]?.id;let created=false;
  if(!contactId){
   await db.batch([db.prepare("INSERT INTO contacts(first_name,last_name,phone,email,relationship,intent,stage,lead_source,sms_consent,email_consent,created_at) VALUES(?,?,?,?,'Lead',?,'Lead',?,?,?,CURRENT_TIMESTAMP)").bind(lead.first_name,lead.last_name,lead.phone,lead.email,lead.intent,lead.source,Number(lead.sms_consent),Number(lead.email_consent)),db.prepare("UPDATE lead_intakes SET contact_id=last_insert_rowid(),dedupe_result='new_contact' WHERE id=?").bind(id)]);
   contactId=(await db.prepare('SELECT contact_id FROM lead_intakes WHERE id=?').bind(id).first<Lead>())!.contact_id;created=true;
  }else{
   await db.prepare("UPDATE contacts SET phone=CASE WHEN phone IS NULL OR phone='' THEN ? ELSE phone END,email=CASE WHEN email IS NULL OR email='' THEN ? ELSE email END,lead_source=CASE WHEN lead_source IS NULL OR lead_source='' THEN ? ELSE lead_source END,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(lead.phone,lead.email,lead.source,contactId).run();
   const existing=matches[0];if(existing){for(const [field,incoming,primary]of [['additional_phones',lead.phone,existing.phone],['additional_emails',lead.email,existing.email]])if(incoming&&primary&&(field==='additional_phones'?leadPhone(primary)!==incoming:String(primary).toLowerCase()!==incoming)){await db.prepare(`UPDATE contacts SET ${field}=CASE WHEN ${field} IS NULL OR ${field}='' THEN ? ELSE ${field}||char(10)||? END WHERE id=? AND instr(COALESCE(${field},''),?)=0`).bind(`${incoming} | Other`,`${incoming} | Other`,contactId,incoming).run();}}
   await db.prepare("UPDATE lead_intakes SET contact_id=?,dedupe_result='matched_existing' WHERE id=?").bind(contactId,id).run();
  }
  await db.prepare("INSERT INTO activities(contact_id,type,title,detail,occurred_at,source_id) SELECT ?,'Lead Received',?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM activities WHERE type='Lead Received' AND source_id=?)").bind(contactId,`${lead.source} · ${lead.subtype}`,[lead.property,lead.message,lead.notes].filter(Boolean).join('\n'),lead.received_at,id,id).run();
  let reason=options.historical?'Historical import; no automation':'Existing contact; enrollment requires review';let enrollmentId:null|number=null;
  const config=await db.prepare('SELECT campaign_id FROM lead_sources WHERE provider=?').bind(provider).first<Lead>();
  const eligibleSource=provider!=='facebook'||lead.subtype==='Facebook Property Lead';
  if(created&&!options.historical&&lead.intent==='Buyer'&&eligibleSource&&config?.campaign_id){
   const activeTransaction=await db.prepare("SELECT 1 FROM transactions WHERE contact_id=? AND status IN ('Active','Under Contract','Pending') LIMIT 1").bind(contactId).first();
   const blocked=await db.prepare("SELECT 1 FROM contacts WHERE id=? AND (sms_opt_out=1 OR email_unsubscribed=1 OR (sms_consent=0 AND email_consent=0))").bind(contactId).first();
   if(!activeTransaction&&!blocked){try{enrollmentId=await enroll(contactId,config.campaign_id,lead.subtype,false);reason=`Lead intake ${id}: ${lead.source}`;}catch{reason='Campaign inactive, conflicting, or unavailable; review required';}}else reason='Active transaction or consent/opt-out restrictions';
  }else if(created&&!eligibleSource)reason='Facebook lead is not a property-ad buyer; follow up manually';
  else if(created&&!config?.campaign_id)reason='No campaign mapped; follow up manually';
  await db.prepare("UPDATE lead_intakes SET processing_status='processed',enrollment_id=?,enrollment_reason=? WHERE id=?").bind(enrollmentId,reason,id).run();
  if(!options.historical)await queueLeadNotifications(id);
  return{id,contact_id:contactId,processing_status:'processed',created,enrollment_id:enrollmentId};
 } finally {await db.prepare('DELETE FROM lead_intake_lock WHERE id=1 AND owner=?').bind(lock).run();}
}
