import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
test('pre-answer bridge requests US ringback; normal bridge retains its payload',async()=>{
  const requests=[],exports={};
  const source=ts.transpileModule(fs.readFileSync(new URL('../lib/telnyx-call-control.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(source,{exports,require:()=>({env:{TELNYX_API_KEY:'fixture',PRIMARY_BUSINESS_PHONE:'+15550000001'}}),console,fetch:async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({data:{result:'ok'}})};}});
  await exports.bridgeCalls({callControlId:'brad-leg',targetCallControlId:'contact-leg',commandId:'flow:ringback',playRingtone:true});
  assert.equal(requests[0].url,'https://api.telnyx.com/v2/calls/brad-leg/actions/bridge');
  assert.equal(requests[0].body.call_control_id,'contact-leg');
  assert.equal(requests[0].body.play_ringtone,true);
  assert.equal(requests[0].body.ringtone,'us');
  await exports.bridgeCalls({callControlId:'contact-leg',targetCallControlId:'brad-leg',commandId:'flow:bridge'});
  assert.equal(requests[1].body.play_ringtone,undefined);
  assert.equal(requests[1].body.call_control_id,'brad-leg');
});
