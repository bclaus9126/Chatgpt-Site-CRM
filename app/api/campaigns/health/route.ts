import { env } from 'cloudflare:workers';
import { authorizeCrmOwner } from '@/lib/crm-auth';

export const dynamic='force-dynamic';
export async function GET() {
  const auth=await authorizeCrmOwner();if(auth.denied)return auth.denied;
  const settings=await env.DB.prepare('SELECT * FROM campaign_settings WHERE id=1').first<Record<string,unknown>>();
  const next=await env.DB.prepare("SELECT MIN(next_action_at) AS next_due FROM campaign_enrollments WHERE status='active' AND (test_mode=0 OR scheduled_test=1) AND next_action_at IS NOT NULL").first<{next_due:string|null}>();
  const age=settings?.scheduler_last_run_at?Date.now()-Date.parse(String(settings.scheduler_last_run_at)):Infinity;
  return Response.json({status:age>15*60000?'warning':'healthy',lastRunnerCall:settings?.scheduler_last_run_at||null,lastSuccess:settings?.scheduler_last_success_at||null,lastFailure:settings?.scheduler_last_failure_at||null,lastFailureReason:settings?.scheduler_last_failure_reason||null,stepsProcessed:settings?.scheduler_last_processed||0,nextDue:next?.next_due||null,automaticSendingEnabled:Number(settings?.automatic_sending_enabled||0)===1,secretConfigured:!!(env as unknown as Record<string,string>).CAMPAIGN_RUNNER_TOKEN},{headers:{'cache-control':'no-store'}});
}
export async function POST(request:Request) {
  const auth=await authorizeCrmOwner();if(auth.denied)return auth.denied;
  const body=await request.json().catch(()=>null) as {automaticSendingEnabled?:unknown}|null;
  if(typeof body?.automaticSendingEnabled!=='boolean') return Response.json({error:'Invalid setting'},{status:400});
  await env.DB.prepare('INSERT INTO campaign_settings (id,automatic_sending_enabled) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET automatic_sending_enabled=excluded.automatic_sending_enabled,updated_at=CURRENT_TIMESTAMP').bind(Number(body.automaticSendingEnabled)).run();
  return GET();
}
