import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path,mocks={}) {const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>{if(!(id in mocks))throw Error(id);return mocks[id]},crypto,console});return exports;}
const normalization=load('../lib/lead-normalization.ts');
async function scenario({provider='facebook',property='129 Hidden Forest',consent=true,historical=false,duplicate=false,existing=false,optedOut=false,transaction=false,conflict=false,intent='buyer'}={}) {
 const calls=[];let resultReason='';
 const db={prepare(sql){let values=[];return {bind(...args){values=args;return this},async run(){if(sql.startsWith('UPDATE lead_intakes SET processing_status'))resultReason=values[1];return {meta:{changes:1,last_row_id:99}}},async all(){return {results:existing?[{id:208,email:'buyer@example.com'}]:[]}},async first(){
 if(sql.startsWith('SELECT id,contact_id,processing_status'))return duplicate?{id:99,contact_id:208,processing_status:'processed',live:1,is_test:0}:null;
 if(sql.startsWith('SELECT contact_id'))return {contact_id:208};
 if(sql.startsWith('SELECT campaign_id'))return {campaign_id:1};
 if(sql.startsWith('SELECT 1 FROM transactions'))return transaction?{id:1}:null;
 if(sql.startsWith('SELECT 1 FROM contacts'))return optedOut||!consent?{id:208}:null;
 throw Error('Unexpected query '+sql);
 }}},async batch(statements){for(const s of statements)await s.run()}};
 const {intakeLead}=load('../lib/lead-intake.ts',{'cloudflare:workers':{env:{DB:db}},'./lead-normalization':normalization,'./lead-notifications':{queueLeadNotifications:async()=>{}},'./campaign':{enroll:async(...args)=>{calls.push(args);if(conflict)throw Error('Already enrolled');return 55}}});
 const result=await intakeLead(provider,{external_lead_id:'fb:123',name:'Test Buyer',email:'buyer@example.com',intent,property_address:property,sms_consent:consent,email_consent:consent},{historical});return {calls,result,reason:resultReason};
}
test('new Facebook property buyer with consent enrolls in mapped campaign',async()=>{const r=await scenario();assert.equal(r.result.enrollment_id,55);assert.equal(r.calls.length,1);assert.deepEqual(Array.from(r.calls[0]),[208,1,'Facebook Property Lead',false]);});
for(const [name,options] of [['general Facebook inquiry',{property:''}],['seller',{intent:'seller'}],['missing consent',{consent:false}],['opted out',{optedOut:true}],['active transaction',{transaction:true}],['historical import',{historical:true}],['retry duplicate',{duplicate:true}],['existing contact',{existing:true}]])test(name+' does not start a new campaign',async()=>{const r=await scenario(options);assert.equal(r.calls.length,0)});
test('existing website buyer enrollment behavior is preserved',async()=>{const r=await scenario({provider:'website'});assert.equal(r.result.enrollment_id,55);assert.equal(r.calls[0][2],'Website Buyer Lead')});
test('conflicting enrollment remains blocked',async()=>{const r=await scenario({conflict:true});assert.equal(r.result.enrollment_id,null);assert.match(r.reason,/conflicting/)});
