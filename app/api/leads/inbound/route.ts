import {env,waitUntil} from 'cloudflare:workers';
import {intakeLead} from '@/lib/lead-intake';
import {deliverLeadNotifications} from '@/lib/lead-notifications';
import {indexPending} from '@/lib/claus-ai/indexer';
import {leadProviders} from '@/lib/lead-normalization';
export async function POST(request:Request){
 const provider=new URL(request.url).searchParams.get('provider')||'generic';if(!leadProviders.includes(provider as any))return Response.json({error:'Unsupported provider'},{status:400});
 const cfg=env as unknown as Record<string,string>;const secret=cfg[`LEAD_INTAKE_${provider.toUpperCase()}_TOKEN`];const auth=request.headers.get('authorization')||'';
 if(!secret||secret.length<32)return Response.json({error:'Provider integration needs server-side token configuration'},{status:503});
 const expected=`Bearer ${secret}`;let diff=auth.length^expected.length;for(let i=0;i<expected.length;i++)diff|=(auth.charCodeAt(i)||0)^expected.charCodeAt(i);if(diff)return Response.json({error:'Unauthorized'},{status:401});
 const config=await env.DB.prepare('SELECT active FROM lead_sources WHERE provider=?').bind(provider).first<{active:number}>();if(!config?.active)return Response.json({error:'Provider is inactive'},{status:403});
 if(Number(request.headers.get('content-length')||0)>100000)return Response.json({error:'Payload too large'},{status:413});
 let input:Record<string,any>;try{const raw=await request.text();if(raw.length>100000)return Response.json({error:'Payload too large'},{status:413});input=JSON.parse(raw);if(!input||Array.isArray(input)||typeof input!=='object')throw Error();}catch{return Response.json({error:'Invalid JSON'},{status:400});}
 try{const result=await intakeLead(provider,input);waitUntil(deliverLeadNotifications(result.id).catch(()=>console.error('Lead notification worker failed',{intakeId:result.id})));waitUntil(indexPending(env.DB,1,false,`lead:${result.id}`).catch(()=>console.error('Lead indexing deferred')));return Response.json(result,{status:result.duplicate?200:201});}
 catch(e){const busy=e instanceof Error&&e.message.startsWith('Intake busy');const validation=e instanceof Error&&/^(Unsupported|Invalid|A valid|A stable)/.test(e.message);const reason=busy?'Intake busy; retry with the same external_lead_id':validation?(e as Error).message:'Lead processing failed; retry with the same external_lead_id';await env.DB.prepare('UPDATE lead_sources SET last_error=?,last_error_at=CURRENT_TIMESTAMP WHERE provider=?').bind(reason,provider).run();return Response.json({error:reason},{status:busy?503:validation?400:500});}
}
