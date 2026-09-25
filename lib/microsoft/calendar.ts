import { env } from "cloudflare:workers";
import { accessToken, connection, graph } from "./graph";

type Appointment = { id:number; type:string; title:string; due_date:string|null; due_time:string|null; status:string; notes:string|null; details:string|null; contact_name:string|null; contact_email:string|null; microsoft_event_id:string|null; microsoft_calendar_id:string|null; calendar_sync_status:string|null; calendar_transaction_id:string|null; calendar_change_key:string|null };
type Event = {id:string; calendarId?:string; changeKey?:string; subject:string; start:{dateTime:string;timeZone:string}; end:{dateTime:string;timeZone:string}; location?:{displayName?:string}; body?:{content?:string}; isCancelled?:boolean};
const TZ="Central Standard Time"; // Microsoft Graph's Windows zone covers Chicago daylight saving time.
const row=(id:number)=>env.DB.prepare("SELECT t.*,trim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')) contact_name,c.email contact_email FROM tasks t LEFT JOIN contacts c ON c.id=t.contact_id WHERE t.id=? AND t.type='Appointment'").bind(id).first<Appointment>();
const details=(a:Appointment)=>{try{return JSON.parse(a.details||"{}") as Record<string,unknown>}catch{return {} as Record<string,unknown>}};
const validTime=(s:string|null)=>!!s && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const eventPath=(id:string)=>`/me/events/${encodeURIComponent(id)}`;
const mark=async(id:number,status:string,error:string|null=null)=>env.DB.prepare("UPDATE tasks SET calendar_sync_status=?,calendar_sync_error=?,last_calendar_sync_at=CURRENT_TIMESTAMP WHERE id=?").bind(status,error?.slice(0,250)||null,id).run();
function addHour(date:string,time:string) {const d=new Date(`${date}T${time}:00Z`); d.setUTCHours(d.getUTCHours()+1); return {date:d.toISOString().slice(0,10),time:d.toISOString().slice(11,16)};}
export async function syncAppointment(id:number) {
  const a=await row(id); if(!a) return;
  if(a.status==="Cancelled") {
    if(a.microsoft_event_id) {
      try { const c=await connection(); if(!c?.calendar_enabled) throw Error("Reconnect Microsoft 365 to enable calendar access"); await graph(await accessToken(c),eventPath(a.microsoft_event_id),{method:"DELETE"}); }
      catch(e) {if(!String(e).includes("404")){await mark(id,"failed",String(e));return;}}
    }
    await env.DB.prepare("UPDATE tasks SET microsoft_event_id=NULL,microsoft_calendar_id=NULL,calendar_change_key=NULL,calendar_transaction_id=NULL,calendar_sync_status='not_synced',calendar_sync_error=NULL,last_calendar_sync_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run(); return;
  }
  if(!a.due_date || !validTime(a.due_time)) {
    if(a.microsoft_event_id) {
      try {const c=await connection();if(!c?.calendar_enabled) throw Error("Reconnect Microsoft 365 to enable calendar access");await graph(await accessToken(c),eventPath(a.microsoft_event_id),{method:"DELETE"});}
      catch(e){if(!String(e).includes("404")){await mark(id,"failed",String(e));return;}}
      await env.DB.prepare("UPDATE tasks SET microsoft_event_id=NULL,microsoft_calendar_id=NULL,calendar_change_key=NULL,calendar_transaction_id=NULL WHERE id=?").bind(id).run();
    }
    await mark(id,"waiting_for_time");return;
  }
  const c=await connection(); if(!c?.calendar_enabled){await mark(id,"failed","Reconnect Microsoft 365 to grant calendar access");return;}
  const d=details(a), start=a.due_time!, end=validTime(String(d.endTime||"")) ? {date:a.due_date,time:String(d.endTime)} : addHour(a.due_date,start);
  if(`${end.date}T${end.time}`<=`${a.due_date}T${start}`){await mark(id,"failed","End time must be after start time");return;}
  if(d.inviteContact && !a.contact_email){await mark(id,"failed","Contact needs an email address for an invitation");return;}
  const transactionId=a.calendar_transaction_id||`claus-crm-${c.graph_user_id}-${id}-${crypto.randomUUID()}`;
  const location=[d.location,d.propertyAddress].filter(Boolean).join(" · ");
  const payload:Record<string,unknown>={subject:a.title,start:{dateTime:`${a.due_date}T${start}:00`,timeZone:TZ},end:{dateTime:`${end.date}T${end.time}:00`,timeZone:TZ},location:{displayName:location},body:{contentType:"text",content:[a.notes,a.contact_name&&`Contact: ${a.contact_name}`,d.propertyAddress&&`Property: ${d.propertyAddress}`].filter(Boolean).join("\n")},attendees:d.inviteContact?[{emailAddress:{address:a.contact_email,name:a.contact_name||undefined},type:"required"}]:[]};
  try {
    // The stable transaction ID makes a repeated POST safe even if Graph succeeded before its response was lost.
    await env.DB.prepare("UPDATE tasks SET calendar_transaction_id=?,calendar_sync_status='pending',calendar_sync_error=NULL WHERE id=?").bind(transactionId,id).run();
    const token=await accessToken(c);
    const event=await graph<Event>(token,a.microsoft_event_id?eventPath(a.microsoft_event_id):"/me/events",{method:a.microsoft_event_id?"PATCH":"POST",body:JSON.stringify(a.microsoft_event_id?payload:{...payload,transactionId})});
    const actual=a.microsoft_event_id?await graph<Event>(token,eventPath(a.microsoft_event_id),{headers:{Prefer:'IdType="ImmutableId", outlook.timezone="Central Standard Time"'}}):event;
    await env.DB.prepare("UPDATE tasks SET microsoft_event_id=?,microsoft_calendar_id=?,calendar_change_key=?,calendar_sync_status='synced',calendar_sync_error=NULL,last_calendar_sync_at=CURRENT_TIMESTAMP WHERE id=?").bind(actual.id||a.microsoft_event_id,actual.calendarId||a.microsoft_calendar_id||"default",actual.changeKey||null,id).run();
  } catch(e) {await mark(id,"failed",String(e));}
}

// Only inspect events already linked to CRM appointments. Personal Outlook events stay outside the CRM.
export async function pullLinkedAppointments() {
  const c=await connection(); if(!c?.calendar_enabled) return {updated:0};
  const token=await accessToken(c);
  const rows=(await env.DB.prepare("SELECT id FROM tasks WHERE type='Appointment' AND microsoft_event_id IS NOT NULL AND calendar_sync_status='synced' ORDER BY id DESC LIMIT 100").all<{id:number}>()).results;
  let updated=0;
  for(const item of rows) {
    const a=await row(item.id); if(!a?.microsoft_event_id) continue;
    try {
      const e=await graph<Event>(token,eventPath(a.microsoft_event_id),{headers:{Prefer:'IdType="ImmutableId", outlook.timezone="Central Standard Time"'}});
      if(!e.changeKey||e.changeKey===a.calendar_change_key) continue;
      if(e.isCancelled){await env.DB.prepare("UPDATE tasks SET status='Cancelled',calendar_change_key=?,last_calendar_sync_at=CURRENT_TIMESTAMP WHERE id=?").bind(e.changeKey,a.id).run();updated++;continue;}
      const date=e.start.dateTime.slice(0,10),time=e.start.dateTime.slice(11,16),endTime=e.end.dateTime.slice(11,16);
      const d={...details(a),endTime:e.end.dateTime.slice(0,10)===date?endTime:null,location:e.location?.displayName||""};
      await env.DB.prepare("UPDATE tasks SET title=?,due_date=?,due_time=?,details=?,calendar_change_key=?,last_calendar_sync_at=CURRENT_TIMESTAMP,update_source='outlook',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(e.subject,date,time,JSON.stringify(d),e.changeKey,a.id).run();updated++;
    } catch(e) {await mark(a.id,"failed",String(e));}
  }
  return {updated};
}
