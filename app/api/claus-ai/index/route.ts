import { authorizeCrmOwner } from '@/lib/crm-auth';
import { env } from 'cloudflare:workers';
import { indexPending, indexStatus } from '@/lib/claus-ai/indexer';
import { AiBudgetError } from '@/lib/claus-ai/budget';

export async function GET() {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  try {return Response.json(await indexStatus(env.DB),{headers:{'Cache-Control':'no-store'}});}catch(e){console.error('Index status query failed',e instanceof Error?e.message:'Unknown');return Response.json({error:'Index status could not be loaded. Please retry.'},{status:503});}
}
export async function POST(request: Request) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  const body = await request.json().catch(()=>({})) as {action?:string};
  let status = await indexStatus(env.DB);
  if (!status.keyConfigured) return Response.json({error:'Add OPENAI_API_KEY as a server-side Site secret before indexing.',...status},{status:409});
  if (body.action === 'rebuild') {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM claus_ai_embeddings'),
      env.DB.prepare("INSERT INTO claus_ai_index_queue(source_kind,source_id,source_key,status,error) SELECT 'communication',id,'communication:'||id,'pending',NULL FROM communications WHERE length(trim(coalesce(message_transcript,'')||coalesce(ai_summary,'')||coalesce(subject,'')))>0 ON CONFLICT(source_key) DO UPDATE SET status='pending',error=NULL"),
      env.DB.prepare("INSERT INTO claus_ai_index_queue(source_kind,source_id,source_key,status,error) SELECT 'note',id,'note:'||id,'pending',NULL FROM notes WHERE length(trim(coalesce(body,'')))>0 ON CONFLICT(source_key) DO UPDATE SET status='pending',error=NULL"),
      env.DB.prepare("INSERT INTO claus_ai_index_queue(source_kind,source_id,source_key,status,error) SELECT 'intelligence',id,'intelligence:'||id,'pending',NULL FROM contact_intelligence WHERE status='Current' AND length(trim(coalesce(value,'')))>0 ON CONFLICT(source_key) DO UPDATE SET status='pending',error=NULL"),
    ]);
    await env.DB.batch(['transactions','properties','buyer_profiles','real_estate_history'].map((table,i)=>env.DB.prepare(`INSERT INTO claus_ai_index_queue(source_kind,source_id,source_key,status,error) SELECT ?,${table==='buyer_profiles'?'contact_id':'id'},?||':'||${table==='buyer_profiles'?'contact_id':'id'},'pending',NULL FROM ${table} WHERE 1=1 ON CONFLICT(source_key) DO UPDATE SET status='pending',error=NULL`).bind(['transaction','property','buyer_profile','listing_history'][i],['transaction','property','buyer_profile','listing_history'][i])));
    return Response.json(await indexStatus(env.DB));
  }
  if (status.needsRebuild) return Response.json({error:'Embedding model changed. Choose Rebuild semantic index first.',...status},{status:409});
  try {
    const result = await indexPending(env.DB,2,body.action==='retry');
    status = await indexStatus(env.DB);
    return Response.json({...result,...status});
  } catch (error) {
    if (error instanceof AiBudgetError) return Response.json({error:error.code==='AI_DAILY_LIMIT'?'AI usage limit reached for today. Pending sources will resume later.':error.code==='AI_MONTHLY_LIMIT'?'AI monthly usage limit reached. Pending sources remain safe.':'Indexing paused by the per-request AI cost or context limit.'},{status:429});
    console.error('Semantic indexing failed',error instanceof Error ? error.name : 'Unknown');
    return Response.json({error:'Search indexing is temporarily unavailable.'},{status:503});
  }
}
