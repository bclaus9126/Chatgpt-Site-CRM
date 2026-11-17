import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function setup(options={}){
 const writes=[],calls=[];
 const contact={id:208,phone:'+12105550123',email:'buyer@example.com',sms_opt_out:0,email_unsubscribed:0,...options.contact};
 const db={prepare(sql){let args;return {bind(...values){args=values;return this},async first(){if(sql.includes('FROM contacts'))return contact;if(sql.includes('FROM campaign_templates'))return {id:1,name:'Facebook Buyer Lead - Initial 14 day Follow-up',active:options.inactive?0:1};if(sql.includes('FROM campaign_enrollments'))return options.existing?{id:3}:null;if(sql.includes('FROM transactions'))return options.transaction?{id:4}:null;throw Error(sql)},async all(){return {results:[{channel:'SMS'},{channel:'email'}]}},async run(){writes.push({sql,args});return {}}}},async batch(items){for(const item of items)await item.run()}};
 const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/manual-campaign-enrollment.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>{assert.equal(id,'./campaign');return {enroll:async(...args)=>{calls.push(args);return 42}}}});
 const input={contactId:208,campaignId:1,leadSubtype:'Facebook Property Lead',smsConsent:true,emailConsent:true,permissionNote:'Customer confirmed automated texts and email by text on October 30.'};
 return {writes,calls,run:changes=>exports.manuallyEnroll(db,{...input,...changes})};
}
test('records channel-specific permission and audit before scheduling the production campaign',async()=>{const s=setup();assert.equal(await s.run(),42);assert.equal(s.writes.length,2);assert.deepEqual(Array.from(s.calls[0]),[208,1,'Facebook Property Lead',false]);assert.match(s.writes[1].args[1],/October 30/);assert.match(s.writes[1].args[1],/Automated SMS: confirmed/);assert.ok(!s.writes[0].sql.includes('sms_opt_out='));assert.ok(!s.writes[0].sql.includes('email_unsubscribed='));});
for(const [name,options,changes,pattern] of [
 ['no text permission',{}, {smsConsent:false},/permission for automated texts/],
 ['no email permission',{}, {emailConsent:false},/permission for follow-up emails/],
 ['no permission record',{}, {permissionNote:' '},/how and when/],
 ['SMS opted out',{contact:{sms_opt_out:1}},{},/opted out/],
 ['email unsubscribed',{contact:{email_unsubscribed:1}},{},/opted out/],
 ['already enrolled',{existing:true},{},/active or paused/],
 ['inactive campaign',{inactive:true},{},/active campaign/],
 ['active transaction',{transaction:true},{},/active transaction/],
 ['invalid contact',{}, {contactId:0},/Choose a contact/],
 ['missing phone',{contact:{phone:''}},{},/phone number/],
 ['missing email',{contact:{email:''}},{},/email address/],
])test(name+' cannot record permission or enroll',async()=>{const s=setup(options);await assert.rejects(()=>s.run(changes),pattern);assert.equal(s.writes.length,0);assert.equal(s.calls.length,0)});
