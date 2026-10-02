import { env } from "cloudflare:workers";
import { authorizeCrmOwner } from "@/lib/crm-auth";
import { ensureStarterCampaign, enroll, prepareInterruptedTestRetry, prepareFailedTestEmailRetry, scheduleStep, stopContact } from "@/lib/campaign";
export const dynamic="force-dynamic";
type Row=Record<string,any>;
const db=()=>env.DB;
const validTime=(v:unknown)=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const channels=['SMS','email','call','task'];
const modes=['automatic','manual','task_only'];
export async function GET() {
  const auth=await authorizeCrmOwner();if(auth.denied)return auth.denied;
  await ensureStarterCampaign();
  const [campaigns,steps,messages,enrollments,executions,settings,overrides]=await Promise.all([
    db().prepare('SELECT * FROM campaign_templates ORDER BY id').all(),
    db().prepare('SELECT * FROM campaign_steps ORDER BY campaign_id,day_number,sequence_order,id').all(),
    db().prepare('SELECT * FROM campaign_messages ORDER BY id DESC').all(),
    db().prepare("SELECT e.*,c.first_name||' '||c.last_name contact_name,p.name campaign_name,s.channel next_channel,s.day_number next_day FROM campaign_enrollments e JOIN contacts c ON c.id=e.contact_id JOIN campaign_templates p ON p.id=e.campaign_id LEFT JOIN campaign_steps s ON s.id=e.current_step_id ORDER BY e.id DESC LIMIT 300").all(),
    db().prepare('SELECT x.*,e.contact_id FROM campaign_executions x JOIN campaign_enrollments e ON e.id=x.enrollment_id ORDER BY x.id DESC LIMIT 500').all(),
    db().prepare('SELECT * FROM campaign_settings WHERE id=1').first(),
    db().prepare('SELECT * FROM campaign_step_templates').all(),
  ]);
  const schedulerConnected=!!(settings as Row|null)?.scheduler_last_run_at && Date.now()-Date.parse((settings as Row).scheduler_last_run_at)<20*60000 && !!(env as unknown as Record<string,string>).CAMPAIGN_RUNNER_TOKEN;
  return Response.json({campaigns:campaigns.results,steps:steps.results,messages:messages.results,enrollments:enrollments.results,executions:executions.results,settings:settings||{message_start:'08:00',message_end:'19:00',call_start:'09:00',call_end:'18:00'},schedulerConnected,overrides:overrides.results},{headers:{'cache-control':'no-store'}});
}
export async function POST(request:Request) {
  const auth=await authorizeCrmOwner();if(auth.denied)return auth.denied;
  let b:Row;try{b=await request.json();}catch{return Response.json({error:'Invalid JSON'},{status:400});}
  try {
    if(b.action==='campaign') {
      const name=String(b.name||'').trim(),type=String(b.campaignType||'').trim();
      if(!name||!type||name.length>140||!['stop','transition'].includes(b.completionBehavior||'stop'))throw Error('Enter a campaign name, type and completion behavior');
      const nextId=b.nextCampaignId?Number(b.nextCampaignId):null;
      if(b.id) await db().prepare('UPDATE campaign_templates SET name=?,description=?,campaign_type=?,completion_behavior=?,next_campaign_id=?,entry_criteria=?,stop_conditions=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(name,String(b.description||'').slice(0,1000),type,b.completionBehavior||'stop',nextId,JSON.stringify(b.entryCriteria||{}),JSON.stringify(b.stopConditions||{}),Number(b.id)).run();
      else await db().prepare('INSERT INTO campaign_templates (name,description,campaign_type,completion_behavior,next_campaign_id,entry_criteria,stop_conditions) VALUES (?,?,?,?,?,?,?)').bind(name,String(b.description||'').slice(0,1000),type,b.completionBehavior||'stop',nextId,JSON.stringify(b.entryCriteria||{}),JSON.stringify(b.stopConditions||{})).run();
    } else if(b.action==='activate') {
      const id=Number(b.id),campaign=await db().prepare('SELECT * FROM campaign_templates WHERE id=?').bind(id).first<Row>();if(!campaign)throw Error('Campaign missing');
      if(b.active) {
        const heartbeat=await db().prepare('SELECT scheduler_last_run_at FROM campaign_settings WHERE id=1').first<Row>();
        if(!heartbeat?.scheduler_last_run_at||Date.now()-Date.parse(heartbeat.scheduler_last_run_at)>20*60000||!(env as unknown as Record<string,string>).CAMPAIGN_RUNNER_TOKEN) throw Error('Unattended scheduler has not been verified recently. Campaign remains inactive.');
        const incomplete=await db().prepare("SELECT COUNT(*) n FROM campaign_steps WHERE campaign_id=? AND active=1 AND channel IN ('SMS','email') AND template_id IS NULL").bind(id).first<Row>();
        if(incomplete?.n) throw Error('Attach approved copy to every automatic SMS and email step before activation.');
      }
      await db().prepare('UPDATE campaign_templates SET active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(Number(!!b.active),id).run();
    } else if(b.action==='message') {
      const channel=String(b.channel),body=String(b.body||'').trim(),name=String(b.name||'').trim(),subject=String(b.subject||'').trim();
      if(!channels.includes(channel)||!name||!body||body.length>10000||channel==='email'&&!subject)throw Error('Enter a name and approved message copy');
      if(b.id) await db().prepare('UPDATE campaign_messages SET name=?,channel=?,lead_subtype=?,subject=?,body=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(name,channel,b.leadSubtype||null,subject||null,body,Number(b.id)).run();
      else await db().prepare('INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES (?,?,?,?,?)').bind(name,channel,b.leadSubtype||null,subject||null,body).run();
    } else if(b.action==='step') {
      const id=Number(b.id),campaignId=Number(b.campaignId),day=Number(b.dayNumber),order=Number(b.sequenceOrder),channel=String(b.channel),mode=String(b.executionMode),time=String(b.scheduledTime);
      if(!Number.isSafeInteger(campaignId)||!Number.isSafeInteger(day)||day<1||day>365||!Number.isSafeInteger(order)||order<0||!channels.includes(channel)||!modes.includes(mode)||!validTime(time)||channel==='call'&&mode!=='task_only'||['SMS','email'].includes(channel)&&mode==='task_only')throw Error('Invalid campaign step');
      const active=await db().prepare("SELECT 1 FROM campaign_enrollments WHERE campaign_id=? AND status IN ('active','paused') LIMIT 1").bind(campaignId).first();if(active)throw Error('Pause or finish active enrollments before changing the schedule');
      const templateId=b.templateId?Number(b.templateId):null;
      if(templateId) {const template=await db().prepare('SELECT channel FROM campaign_messages WHERE id=?').bind(templateId).first<Row>();if(template?.channel!==channel)throw Error('Template channel does not match step');}
      if(id)await db().prepare('UPDATE campaign_steps SET day_number=?,sequence_order=?,channel=?,scheduled_time=?,relative_delay=?,template_id=?,execution_mode=?,ai_personalization_enabled=?,skip_conditions=?,active=? WHERE id=? AND campaign_id=?').bind(day,order,channel,time,Math.max(0,Number(b.relativeDelay)||0),templateId,mode,Number(!!b.aiPersonalizationEnabled),JSON.stringify(b.skipConditions||{}),Number(b.active!==false),id,campaignId).run();
      else await db().prepare('INSERT INTO campaign_steps (campaign_id,day_number,sequence_order,channel,scheduled_time,relative_delay,template_id,execution_mode,ai_personalization_enabled,skip_conditions,active) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(campaignId,day,order,channel,time,Math.max(0,Number(b.relativeDelay)||0),templateId,mode,Number(!!b.aiPersonalizationEnabled),JSON.stringify(b.skipConditions||{}),1).run();
    } else if(b.action==='override') {
      const stepId=Number(b.stepId),subtype=String(b.leadSubtype||''),templateId=Number(b.templateId);
      if(!Number.isSafeInteger(stepId)||!["Website Buyer Lead","Facebook Property Lead","Facebook General Buyer Lead"].includes(subtype))throw Error('Invalid subtype');
      const step=await db().prepare('SELECT channel FROM campaign_steps WHERE id=?').bind(stepId).first<Row>();if(!step)throw Error('Step missing');
      if(!templateId)await db().prepare('DELETE FROM campaign_step_templates WHERE step_id=? AND lead_subtype=?').bind(stepId,subtype).run();
      else {const m=await db().prepare('SELECT channel FROM campaign_messages WHERE id=?').bind(templateId).first<Row>();if(m?.channel!==step.channel)throw Error('Template channel mismatch');await db().prepare('INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) VALUES (?,?,?) ON CONFLICT(step_id,lead_subtype) DO UPDATE SET template_id=excluded.template_id').bind(stepId,subtype,templateId).run();}
    } else if(b.action==='responsive') {
      const contactId=Number(b.contactId);if(!Number.isSafeInteger(contactId))throw Error('Invalid contact');await stopContact(contactId,'Marked responsive by Brad');
    } else if(b.action==='enroll') {
      await enroll(Number(b.contactId),Number(b.campaignId),b.leadSubtype||null,!!b.testMode,Number(b.testIntervalMinutes)||5);
    } else if(b.action==='retry_interrupted_test' && b.confirmedNotReceived===true) {
      await prepareInterruptedTestRetry(Number(b.id));
    } else if(b.action==='retry_test_email') {
      await prepareFailedTestEmailRetry(Number(b.id));
    } else if(['pause','resume','stop'].includes(b.action)) {
      const id=Number(b.id),row=await db().prepare('SELECT * FROM campaign_enrollments WHERE id=?').bind(id).first<Row>();if(!row)throw Error('Enrollment missing');
      if(b.action==='stop')await stopContact(row.contact_id,'Stopped by Brad');
      if(b.action==='pause'&&row.status==='active')await db().prepare("UPDATE campaign_enrollments SET status='paused',paused_at=? WHERE id=?").bind(new Date().toISOString(),id).run();
      if(b.action==='resume'&&row.status==='paused') {const step=await db().prepare('SELECT * FROM campaign_steps WHERE id=?').bind(row.current_step_id).first<Row>();if(!step)throw Error('Next step missing');await db().prepare("UPDATE campaign_enrollments SET status='active',paused_at=NULL,next_action_at=? WHERE id=?").bind(await scheduleStep(row,step),id).run();}
    } else if(b.action==='settings') {
      if(![b.messageStart,b.messageEnd,b.callStart,b.callEnd].every(validTime)||b.messageStart>=b.messageEnd||b.callStart>=b.callEnd)throw Error('Enter valid business-hour windows');
      await db().prepare('INSERT INTO campaign_settings (id,message_start,message_end,call_start,call_end) VALUES (1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET message_start=excluded.message_start,message_end=excluded.message_end,call_start=excluded.call_start,call_end=excluded.call_end,updated_at=CURRENT_TIMESTAMP').bind(b.messageStart,b.messageEnd,b.callStart,b.callEnd).run();
    } else if(b.action==='consent') {
      const id=Number(b.contactId);if(!Number.isSafeInteger(id)||id<1)throw Error('Invalid contact');
      await db().prepare('UPDATE contacts SET sms_consent=?,sms_opt_out=?,email_consent=?,email_unsubscribed=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(Number(!!b.smsConsent),Number(!!b.smsOptOut),Number(!!b.emailConsent),Number(!!b.emailUnsubscribed),id).run();
      if(b.smsOptOut||b.emailUnsubscribed)await stopContact(id,'Opted out');
    } else throw Error('Unknown action');
    return await GET();
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Could not save campaign'},{status:400});}
}
