import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';
function loadPush(rows, send=async()=>{}) {
  const queries=[], sends=[], logs=[];
  const env={VAPID_PUBLIC_KEY:'public',VAPID_PRIVATE_KEY:'private',CRM_OWNER_EMAIL:'owner@example.test',DB:{prepare(sql){queries.push(sql);return {bind(...args){queries.push(args);return this;},async all(){return {results:rows};},async first(){return null;},async run(){return {meta:{changes:1}};}};}}};
  const webpush={setVapidDetails(){},async sendNotification(sub,payload){sends.push({sub,payload:JSON.parse(payload)});return send(sub);}};
  const exports={};
  const source=ts.transpileModule(fs.readFileSync(new URL('../lib/push.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(source,{exports,require:name=>name==='cloudflare:workers'?{env}:{default:webpush},console:{info:(...v)=>logs.push(v),warn:(...v)=>logs.push(v),error:(...v)=>logs.push(v)},URL,Intl,Date,crypto:webcrypto});
  return {api:exports,queries,sends,logs};
}
test('missing push device is explicitly diagnosed without a delivery attempt',async()=>{
  const fixture=loadPush([]);
  await fixture.api.notifyInboundSms(99,{id:40,first_name:'Example',last_name:'Contact'},'+15550000000','Yes ','https://example.test');
  assert.equal(fixture.sends.length,0);
  assert.ok(fixture.logs.some(v=>v[1]?.reason==='no_subscriptions'));
});
test('test push scopes subscriptions to owner and creates no communication',async()=>{
  const f=loadPush([{endpoint:'https://push.example.test/device',p256dh:'key',auth:'auth'}]);
  const result=await f.api.sendTestPush('owner-id');
  assert.equal(result.accepted,1);
  assert.ok(f.queries.includes('SELECT * FROM push_subscriptions WHERE owner_user_id=?'));
  assert.equal(f.sends[0].payload.title,'Claus CRM Test');
  assert.equal(f.sends[0].payload.body,'Push notifications are working.');
  assert.ok(!f.queries.some(q=>typeof q==='string'&&/INSERT.*communications/i.test(q)));
});
test('expired test push device is removed and reports provider status',async()=>{
  const f=loadPush([{endpoint:'https://push.example.test/device',p256dh:'key',auth:'auth'}],async()=>{throw {statusCode:410};});
  const result=await f.api.sendTestPush('owner-id');
  assert.equal(result.failed,1);
  assert.equal(result.errors[0],'provider_http_410');
  assert.ok(f.queries.some(q=>typeof q==='string'&&q.startsWith('DELETE FROM push_subscriptions')));
});
test('Known-contact payload and service worker tap retain exact message destination',async()=>{
  const f=loadPush([{endpoint:'https://push.example.test/device',p256dh:'key',auth:'auth'}]);
  await f.api.notifyInboundSms(99,{id:40,first_name:'Example',last_name:'Contact'},'+15550000000','Yes ','https://example.test');
  const payload=f.sends[0].payload;
  assert.equal(payload.title,'New text from Example Contact');assert.equal(payload.body,'Yes');
  const handlers={},shown=[],opened=[];
  vm.runInNewContext(fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{URL,self:{location:{origin:'https://example.test'},addEventListener:(type,fn)=>handlers[type]=fn,registration:{showNotification:async(title,options)=>shown.push({title,options})},clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}}});
  let pending;handlers.push({data:{json:()=>payload},waitUntil:p=>pending=p});await pending;
  handlers.notificationclick({notification:{data:shown[0].options.data,close(){}},waitUntil:p=>pending=p});await pending;
  assert.equal(opened[0],'https://example.test/?sms_contact=40&sms_message=99');
});
