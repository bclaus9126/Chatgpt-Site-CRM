import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { smsDelivery } from '../lib/sms-delivery.mjs';
import { TOKEN_LIMITS } from '../lib/claus-ai/cost-policy.mjs';

const require = createRequire(import.meta.url);
function load(path, mocks, globals = {}) {
  const output = ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports = {};
  const sourceRequire = createRequire(new URL(path, import.meta.url));
  vm.runInNewContext(output,{exports,require:id=>id in mocks?mocks[id]:sourceRequire(id),console,Response,Request,URL,AbortController,AbortSignal,setTimeout,clearTimeout,...globals});
  return exports;
}

test('SMS drafts have room for complete JSON and do not spend their reply cap on reasoning', async () => {
  const calls=[];
  const env={AI_REASONING_PROVIDER:'openai',AI_REASONING_MODEL:'gpt-5.6-sol',OPENAI_API_KEY:'fake-key'};
  const budget={AiBudgetError:class extends Error{},meteredRequest:async(input,invoke)=>(await invoke(TOKEN_LIMITS[input.taskType].output)).value};
  const provider=load('../lib/claus-ai/provider.ts',{'cloudflare:workers':{env},'./budget':budget}, {fetch:async(url,init)=>{calls.push(JSON.parse(init.body));return Response.json({choices:[{message:{content:'{"draft":"Thanks for the update."}'}}],usage:{prompt_tokens:20,completion_tokens:12}});}});
  const result=await provider.complete('Return JSON','Draft a short reply','reasoning',{taskType:'sms_draft'});
  assert.equal(JSON.parse(result.text).draft,'Thanks for the update.');
  assert.equal(calls[0].reasoning_effort,'none');
  assert.equal(calls[0].response_format.type,'json_object');
  assert.equal(calls[0].max_completion_tokens,400);
  await provider.complete('Return JSON','Compare the dates','reasoning',{taskType:'reasoning'});
  assert.equal(calls[1].reasoning_effort,undefined,'general reasoning retains its existing behavior');
});

function messaging(fetcher) {
  const writes=[];
  const db={prepare(sql){let values;return {bind(...args){values=args;return this;},async first(){return sql.includes('phone,first_name')?{id:13,phone:'+12105550123',first_name:'Test',last_name:'Contact'}:{id:42};},async run(){writes.push({sql,values});return {meta:{changes:1}};}};}};
  const api=load('../app/api/telnyx/messages/route.ts',{
    '@/lib/crm-auth':{authorizeCrmOwner:async()=>({user:{}})},
    'cloudflare:workers':{env:{DB:db,TELNYX_API_KEY:'fake-key'}},
    '@/lib/telnyx-call-control':{BUSINESS_NUMBER:'+12105550999',normalizePhone:x=>x},
    '@/lib/telnyx-media':{isStoredImageUrl:async()=>true},
  },{fetch:fetcher});
  return {api,writes};
}
const messageId='11111111-1111-4111-8111-111111111111';
const sendRequest=()=>new Request('https://example.com/api/telnyx/messages',{method:'POST',body:JSON.stringify({contactId:13,text:'Test only',idempotencyKey:messageId})});

test('the Today composer send API records the accepted message and returns a pending receipt',async()=>{
  let calls=0;
  const {api,writes}=messaging(async(url,init)=>{calls++;assert.equal(JSON.parse(init.body).to,'+12105550123');return Response.json({data:{id:messageId,to:[{status:'queued'}]}});});
  const response=await api.POST(sendRequest());const result=await response.json();
  assert.equal(response.status,200);assert.equal(result.messageId,messageId);assert.equal(result.to,'+12105550123');assert.equal(result.status,'queued');
  assert.equal(smsDelivery(result.status).terminal,false);
  assert.equal(calls,1);assert.ok(writes.some(x=>x.sql.includes('INSERT INTO communications')));
});

test('carrier rejections are errors, never successful sends',async()=>{
  const {api,writes}=messaging(async()=>Response.json({errors:[{code:'40001',title:'Rejected test'}]},{status:422}));
  const response=await api.POST(sendRequest());assert.equal(response.status,502);
  assert.match((await response.json()).error,/Rejected test/);
  assert.equal(writes.some(x=>x.sql.includes('INSERT INTO communications')),false);
});

test('delivery lookup surfaces the carrier failure reason and never caches it',async()=>{
  const {api}=messaging(async()=>Response.json({data:{to:[{status:'delivery_failed',errors:[{code:'40008',title:'Recipient unavailable'}]}]}}));
  const response=await api.GET(new Request('https://example.com/api/telnyx/messages?messageId='+messageId));
  const result=await response.json();assert.match(result.reason,/Recipient unavailable/);
  assert.equal(smsDelivery(result.status,result.reason).failed,true);assert.equal(response.headers.get('cache-control'),'no-store');
});

test('delivery receipts distinguish accepted, sent, delivered and unsuccessful statuses',()=>{
  for(const status of ['queued','sent','sending','unknown'])assert.equal(smsDelivery(status).terminal,false);
  assert.equal(smsDelivery('Delivered').label,'Message delivered.');
  for(const status of ['Failed','delivery_failed','delivery_unconfirmed','rejected'])assert.equal(smsDelivery(status).failed,true);
});
