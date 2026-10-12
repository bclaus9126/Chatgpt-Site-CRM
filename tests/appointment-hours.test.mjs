import test from 'node:test';
import assert from 'node:assert/strict';
import {validAppointmentTime,resolveAppointmentTime} from '../lib/appointment-hours.ts';
import {analyzeSmsConversation} from '../lib/sms-analysis.ts';
test('appointment hours include boundaries and preserve date-only scheduling',()=>{
 for(const value of ['07:00','13:00','20:00',null,undefined,'']) assert.equal(validAppointmentTime(value),true);
 for(const value of ['06:59','20:01','01:00','13:60','7:00']) assert.equal(validAppointmentTime(value),false);
});
test('implicit AM/PM uses only an unambiguous allowed time',()=>{
 assert.deepEqual(resolveAppointmentTime("Okay let's do 1"),{time:'13:00',needsReview:false});
 assert.deepEqual(resolveAppointmentTime('at 7'),{needsReview:true});
 assert.deepEqual(resolveAppointmentTime('at 1 AM'),{needsReview:true});
 assert.deepEqual(resolveAppointmentTime('at 8 pm'),{time:'20:00',needsReview:false});
});
test('SMS appointment confirmation does not turn 1 into 1 AM',()=>{
 const result=analyzeSmsConversation([
 {id:1,sender:'Client',recipient:'Brad Claus',body:'Can we meet tomorrow at 1?',occurredAt:'2026-10-11T15:00:00Z'},
 {id:2,sender:'Brad Claus',recipient:'Client',body:"Okay let's do 1",occurredAt:'2026-10-11T15:01:00Z'}
 ],'Client').find(s=>s.category==='APPOINTMENT');
 assert.ok(result); assert.equal(result.dueTime,'13:00'); assert.equal(result.needsReview,false);
});
