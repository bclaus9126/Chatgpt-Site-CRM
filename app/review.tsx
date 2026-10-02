"use client";
import { useMemo, useState } from "react";

type Rec = Record<string, any>;
type ReviewData = {contacts:Rec[];communications:Rec[];communicationSuggestions:Rec[];intelligence:Rec[]};
export type ReviewItem = Rec & {communication:Rec;contact:Rec};
const sourceName = (type: string) => type === "Call" ? "Calls" : type === "Voice Memo" ? "Voice Memos" : type === "Email" ? "Emails" : "Texts";
export const reviewPriority = (item: Rec) => {
  const category = String(item.category || "").toUpperCase();
  if (category.includes("APPOINTMENT")) return 0;
  if (item.commitment || category.includes("COMMITMENT") || category.includes("PROMISE")) return 1;
  if (/TASK|FOLLOW-UP/.test(category)) return 2;
  if (/TRANSACTION|CLOSING|CONTRACT|FINANC/.test(category)) return 3;
  if (/BUYER|SELLER|PROPERTY|PRICE|MOVING PLAN/.test(category)) return 4;
  if (/DATE|MOMENT|ANNIVERSARY|BIRTHDAY/.test(category)) return 5;
  if (/RELATIONSHIP|PERSONAL|MOTIVATION|CONCERN/.test(category)) return 6;
  return 7;
};
export function reviewItems(data: ReviewData, includeSuperseded = false): ReviewItem[] {
  const comms = new Map(data.communications.map(c => [Number(c.id),c]));
  const contacts = new Map(data.contacts.map(c => [Number(c.id),c]));
  return data.communicationSuggestions.filter(s => s.status === "Suggested" || includeSuperseded && s.status === "Superseded").flatMap(s => {
    const communication = comms.get(Number(s.communication_id));
    const contact = contacts.get(Number(communication?.contact_id));
    return communication && contact && ["Call","Voice Memo","SMS","Text","Email"].includes(communication.type) ? [{...s,communication,contact}] : [];
  });
}
const timestamp = (value: unknown) => {
  const raw = String(value || "");
  const time = Date.parse(raw.includes("T") ? raw : `${raw.replace(" ","T")}Z`);
  return Number.isFinite(time) ? time : 0;
};
const when = (value: unknown) => timestamp(value) ? new Date(timestamp(value)).toLocaleString("en-US",{timeZone:"America/Chicago",month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}) : "Date unknown";
const age = (createdAt: unknown, now: number) => {const elapsed=(now-timestamp(createdAt))/864e5;return elapsed<1 ? "New" : elapsed<4 ? "Waiting" : elapsed<8 ? "Aging" : "Overdue review";};
const categoryGroup = (item: Rec) => {
  const c=String(item.category || "").toUpperCase();
  if (c.includes("APPOINTMENT")) return "Appointments";
  if (item.commitment || /PROMISE|COMMITMENT/.test(c)) return "Commitments";
  if (c.includes("FOLLOW-UP")) return "Follow-Ups";
  if (c.includes("TASK")) return "Tasks";
  if (/BUYER/.test(c)) return "Buyer Intelligence";
  if (/SELLER|PROPERTY|PRICE|MOVING PLAN/.test(c)) return "Seller Intelligence";
  if (/TRANSACTION|CLOSING|CONTRACT/.test(c)) return "Transaction Intelligence";
  if (/RELATIONSHIP|PERSONAL/.test(c)) return "Relationship Intelligence";
  if (/DATE|MOMENT|BIRTHDAY/.test(c)) return "Important Dates";
  if (/CONCERN|OBJECTION/.test(c)) return "Concerns";
  if (/MOTIVATION/.test(c)) return "Motivations";
  if (/CONTACT|ADDRESS/.test(c)) return "Contact Facts";
  return "Other";
};

export function ReviewPage({data,contactId,openSource,reload}:{data:ReviewData;contactId:number|null;openSource:(item:ReviewItem)=>void;reload:()=>Promise<void>}) {
  const [now] = useState(()=>Date.now());
  const [source,setSource]=useState("All"),[category,setCategory]=useState("All"),[contactSearch,setContactSearch]=useState(""),[ageFilter,setAgeFilter]=useState("All"),[sort,setSort]=useState("Priority"),[showSuperseded,setShowSuperseded]=useState(false);
  const [selected,setSelected]=useState<number[]>([]),[editing,setEditing]=useState<number|null>(null),[draft,setDraft]=useState<Rec>({}),[busy,setBusy]=useState(false),[error,setError]=useState(""),[reason,setReason]=useState("");
  const items=useMemo(()=>reviewItems(data,showSuperseded),[data,showSuperseded]);
  const filtered=items.filter(item=>{
    if(contactId && Number(item.contact.id)!==contactId) return false;
    if(source!=="All" && sourceName(item.communication.type)!==source) return false;
    if(category!=="All" && categoryGroup(item)!==category) return false;
    if(contactSearch && !`${item.contact.first_name} ${item.contact.last_name}`.toLowerCase().includes(contactSearch.toLowerCase())) return false;
    const days=(now-timestamp(item.created_at))/864e5;
    if(ageFilter==="Today" && new Intl.DateTimeFormat("en-CA",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(timestamp(item.created_at))) !== new Intl.DateTimeFormat("en-CA",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(now))) return false;
    if(ageFilter==="Last 3 days" && days>3 || ageFilter==="Last 7 days" && days>7 || ageFilter==="Older" && days<=7) return false;
    return true;
  }).sort((a,b)=>{
    if(sort==="Priority") return reviewPriority(a)-reviewPriority(b) || timestamp(a.created_at)-timestamp(b.created_at) || Number(a.id)-Number(b.id);
    if(sort==="Newest") return timestamp(b.created_at)-timestamp(a.created_at);
    if(sort==="Oldest") return timestamp(a.created_at)-timestamp(b.created_at);
    if(sort==="Contact") return `${a.contact.first_name} ${a.contact.last_name}`.localeCompare(`${b.contact.first_name} ${b.contact.last_name}`);
    if(sort==="Type") return String(a.category).localeCompare(String(b.category));
    return sourceName(a.communication.type).localeCompare(sourceName(b.communication.type));
  });
  const act=async (chosen:ReviewItem[],dismiss=false)=>{
    if(!chosen.length) return;
    setBusy(true);setError("");
    try {
      if(dismiss)for(let offset=0;offset<chosen.length;offset+=100){const r=await fetch("/api/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids:chosen.slice(offset,offset+100).map(i=>i.id),reason})});if(!r.ok)throw Error((await r.json() as Rec).error||"Could not dismiss recommendations.");}
      else {
        const grouped=new Map<number,number[]>();for(const item of chosen)grouped.set(item.communication_id,[...(grouped.get(item.communication_id)||[]),item.id]);
        for(const [communicationId,ids] of grouped) for(let offset=0;offset<ids.length;offset+=20){const r=await fetch(`/api/voice-memos/${communicationId}/suggestions`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids:ids.slice(offset,offset+20)})});if(!r.ok)throw Error((await r.json() as Rec).error||"Could not accept recommendations.");}
      }
      setSelected([]);setEditing(null);await reload();
    }catch(e){setError(e instanceof Error?e.message:"Could not save review.");await reload();}finally{setBusy(false);}
  };
  const save=async(item:ReviewItem)=>{
    setBusy(true);setError("");
    try{const r=await fetch("/api/review",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:item.id,title:draft.title,detail:draft.detail,dueDate:draft.due_date,dueTime:draft.due_time,fieldValue:draft.field_value})});if(!r.ok)throw Error((await r.json() as Rec).error||"Could not edit recommendation.");setEditing(null);await reload();}
    catch(e){setError(e instanceof Error?e.message:"Could not edit recommendation.");}finally{setBusy(false);}
  };
  const currentValue=(item:ReviewItem)=>{
    if(!item.field_name)return null;
    const fact=data.intelligence.find(f=>Number(f.contact_id)===Number(item.contact.id)&&f.field_name===item.field_name&&f.status==="Current");
    const contactField:Record<string,string>={contact_address:"address",seller_property:"property_address",seller_timeline:"selling_timeline",buyer_price_range:"price_range",target_locations:"target_locations",financing_type:"financing_type",motivation:"motivation",concerns:"concerns"};
    return fact?.value||item.contact[contactField[item.field_name]]||null;
  };
  const canAccept=(item:ReviewItem)=>item.status==="Suggested" && !item.needs_review && !(item.category==="ADDRESS REVIEW"&&!item.field_value) && !(["APPOINTMENT","FOLLOW-UP","RELATIONSHIP MOMENT"].includes(item.category)&&!item.due_date) && !(item.category==="TASK"&&!item.due_date&&! ["SMS","Text","Email"].includes(item.communication.type));
  return <section className="review-page">
    <header><h2>Intelligence Review</h2><p>{reviewItems(data).length} recommendations need review. Accept only what belongs in the CRM.</p></header>
    {contactId && <p className="review-contact-filter">Showing one contact. Use the Contacts page to change contact.</p>}
    <div className="review-filters">
      <label>Source<select value={source} onChange={e=>setSource(e.target.value)}>{["All","Calls","Texts","Emails","Voice Memos"].map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Intelligence type<select value={category} onChange={e=>setCategory(e.target.value)}>{["All","Appointments","Commitments","Tasks","Follow-Ups","Buyer Intelligence","Seller Intelligence","Transaction Intelligence","Relationship Intelligence","Contact Facts","Important Dates","Concerns","Motivations","Other"].map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Contact<input value={contactSearch} onChange={e=>setContactSearch(e.target.value)} placeholder="Search contact" /></label>
      <label>Age<select value={ageFilter} onChange={e=>setAgeFilter(e.target.value)}>{["All","Today","Last 3 days","Last 7 days","Older"].map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Sort<select value={sort} onChange={e=>setSort(e.target.value)}>{["Priority","Newest","Oldest","Contact","Type","Source"].map(x=><option key={x}>{x}</option>)}</select></label>
      <label className="review-toggle"><input type="checkbox" checked={showSuperseded} onChange={e=>setShowSuperseded(e.target.checked)}/>Show superseded</label>
    </div>
    {error&&<p role="alert" className="error">{error}</p>}
    {selected.length>0&&<div className="review-bulk"><b>{selected.length} selected</b><button disabled={busy||selected.some(id=>!canAccept(items.find(i=>i.id===id)!))} onClick={()=>act(items.filter(i=>selected.includes(i.id)))}>Accept Selected</button><button disabled={busy} onClick={()=>act(items.filter(i=>selected.includes(i.id)),true)}>Dismiss Selected</button><label>Dismissal reason (optional)<select value={reason} onChange={e=>setReason(e.target.value)}>{["","Incorrect","Not useful","Already handled","Duplicate","Outdated","Other"].map(x=><option key={x} value={x}>{x||"No reason"}</option>)}</select></label></div>}
    {!reviewItems(data).length&&!showSuperseded?<div className="review-empty"><h3>You&apos;re caught up.</h3><p>No intelligence recommendations need review.</p></div>:!filtered.length?<p className="review-empty">No recommendations match these filters.</p>:<div className="review-list">{filtered.map(item=><article className="review-card" key={item.id}>
      <div className="review-card-head"><label>{item.status==="Suggested"&&<input type="checkbox" aria-label={`Select ${item.title}`} checked={selected.includes(item.id)} onChange={e=>setSelected(e.target.checked?[...selected,item.id]:selected.filter(id=>id!==item.id))}/>}<strong>{item.contact.display_name||`${item.contact.first_name} ${item.contact.last_name}`}</strong></label><span>{sourceName(item.communication.type)} · {when(item.communication.occurred_at)}</span><em>{item.status==="Superseded"?"Superseded":age(item.created_at,now)}</em></div>
      <b>{item.category}{item.commitment?" · PROMISED":""}</b><h3>{item.title}</h3><p className="review-proposed"><strong>Proposed:</strong> {[item.due_date,item.due_time,item.daypart,item.field_value,item.detail].filter(Boolean).join(" · ")||item.title}</p>
      {currentValue(item)&&<p><strong>Current CRM value:</strong> {currentValue(item)}</p>}
      {item.source_excerpt&&<blockquote><strong>Source:</strong> {item.source_excerpt}</blockquote>}
      {item.confidence!=null&&<small>Confidence: {Math.round(Number(item.confidence)*100)}%</small>}{item.needs_review===1&&<p className="review-ambiguity">Needs review: resolve the missing or ambiguous value before accepting.</p>}
      {item.original_value&&<details><summary>Original extraction</summary><pre>{item.original_value}</pre></details>}
      {editing===item.id&&<div className="review-edit"><label>Wording<input value={draft.title||""} onChange={e=>setDraft({...draft,title:e.target.value})}/></label><label>Detail<textarea value={draft.detail||""} onChange={e=>setDraft({...draft,detail:e.target.value})}/></label><label>Date<input type="date" value={draft.due_date||""} onChange={e=>setDraft({...draft,due_date:e.target.value})}/></label><label>Time<input type="time" value={draft.due_time||""} onChange={e=>setDraft({...draft,due_time:e.target.value})}/></label><label>Fact or value<input value={draft.field_value||""} onChange={e=>setDraft({...draft,field_value:e.target.value})}/></label><button disabled={busy||!String(draft.title||"").trim()} onClick={()=>save(item)}>Save edit</button><button disabled={busy} onClick={()=>setEditing(null)}>Cancel</button></div>}
      <div className="review-actions">{item.status==="Suggested"&&<><button disabled={busy||!canAccept(item)} onClick={()=>act([item])}>Accept</button><button disabled={busy} onClick={()=>{setEditing(item.id);setDraft({...item});}}>Edit</button><button disabled={busy} onClick={()=>act([item],true)}>Dismiss</button></>}<button onClick={()=>openSource(item)}>View Source</button></div>
    </article>)}</div>}
  </section>;
}
export {sourceName};
