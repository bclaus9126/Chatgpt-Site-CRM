import { migrateExisting } from '@/lib/real-estate';
import { env, waitUntil } from 'cloudflare:workers';
import { runDue } from '@/lib/campaign';

export const dynamic='force-dynamic';

function authorized(request:Request) {
  const expected=(env as unknown as Record<string,string>).CAMPAIGN_RUNNER_TOKEN;
  const header=request.headers.get('authorization')||'';
  if(!expected || !header.startsWith('Bearer ')) return false;
  const supplied=header.slice(7);
  const a=new TextEncoder().encode(expected),b=new TextEncoder().encode(supplied);
  let mismatch=a.length^b.length;
  for(let i=0;i<Math.max(a.length,b.length);i++) mismatch|=(a[i]||0)^(b[i]||0);
  return mismatch===0;
}

export async function POST(request:Request) {
  if(!authorized(request)) return Response.json({error:'Unauthorized'},{status:401,headers:{'cache-control':'no-store'}});
  waitUntil(migrateExisting().catch(()=>console.error('Real estate backfill deferred')));
  try {waitUntil(runDue(1,false).catch(async()=>{await env.DB.prepare("UPDATE campaign_settings SET scheduler_last_failure_at=?,scheduler_last_failure_reason='Background runner failed; review execution history' WHERE id=1").bind(new Date().toISOString()).run();}));return Response.json({accepted:true,status:'queued',summaryLocation:'/api/campaigns/health'},{headers:{'cache-control':'no-store'}});}
  catch(error) {
    const reason=error instanceof Error?error.message:'Runner failure';
    try {await env.DB.prepare("UPDATE campaign_settings SET scheduler_last_failure_at=?,scheduler_last_failure_reason=? WHERE id=1").bind(new Date().toISOString(),reason.slice(0,300)).run();} catch {}
    return Response.json({error:'Campaign runner failed'},{status:500,headers:{'cache-control':'no-store'}});
  }
}
