import { env, waitUntil } from 'cloudflare:workers';
import { allFields, buyerGroups, transactionGroups, propertyGroups, transactionStatuses, type FieldGroup } from './real-estate-fields';
import { indexPending } from './claus-ai/indexer';
type Row=Record<string,any>;
export const db=()=>env.DB;
export function validated(values:Row,groups:FieldGroup[]) {
 const output:Row={};
 for(const f of allFields(groups)) if(Object.hasOwn(values,f.key)) {
  const raw=values[f.key]; if(raw===null||raw===''){output[f.key]=null;continue;}
  if(['currency','number','percent'].includes(f.type)) {const n=Number(String(raw).replace(/[$,]/g,''));if(!Number.isFinite(n)||n<0||f.type==='percent'&&n>100)throw Error(`Check ${f.label}`); output[f.key]=n;}
  else if(f.type==='boolean') {if(![0,1,true,false,'0','1'].includes(raw))throw Error(`Check ${f.label}`);output[f.key]=Number(raw===true||raw===1||raw==='1');}
  else {const s=String(raw).trim();if(s.length>12000||f.type==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)||f.type==='url'&&!/^https?:\/\//i.test(s))throw Error(`Check ${f.label}`);output[f.key]=s;}
 }
 return output;
}
export async function saveEntity(kind:string,id:number,values:Row,revision:number,source='manual',sourceId:string|null=null,sourceDate:string|null=null) {
 if(!['transaction','property','buyer_profile'].includes(kind))throw Error('Invalid record type');
 const table=kind==='transaction'?'transactions':kind==='property'?'properties':'buyer_profiles', key=kind==='buyer_profile'?'contact_id':'id';
 const old=await db().prepare(`SELECT * FROM ${table} WHERE ${key}=?`).bind(id).first<Row>();if(!old)throw Error('Record not found');if(Number(old.revision)!==revision)throw Error('This record changed. Reload before saving.');
 const allowed=validated(values,kind==='transaction'?transactionGroups:kind==='property'?propertyGroups:buyerGroups);
 if(kind==='transaction') {for(const k of ['side','status','property_address','lead_source','agent'])if(Object.hasOwn(values,k))allowed[k]=String(values[k]||'').trim()||null;if(allowed.side&&!['SELLER','BUYER'].includes(allowed.side))throw Error('Choose a transaction side');if(allowed.status&&!transactionStatuses.includes(allowed.status))throw Error('Choose a transaction status');}
 if(kind==='property'&&Object.hasOwn(values,'address')){allowed.address=String(values.address||'').trim();if(!allowed.address)throw Error('Enter a property address');}
 if(kind==='transaction'&&allowed.current_price!=null&&old.current_price!=null&&Number(allowed.current_price)<Number(old.current_price)&&!Object.hasOwn(allowed,'number_of_price_reductions'))allowed.number_of_price_reductions=Number(old.number_of_price_reductions||0)+1;
 const changed=Object.entries(allowed).filter(([k,v])=>String(v??'')!==String(old[k]??''));if(!changed.length)return old;
 const contactId=kind==='buyer_profile'?id:old.contact_id;
 const writes=changed.map(([k,v])=>db().prepare(`INSERT INTO real_estate_history(entity_type,entity_id,contact_id,transaction_id,field_name,old_value,new_value,changed_by,source,source_record_id,source_date) SELECT ?,?,?,?,?,?,?,'Brad Claus',?,?,? FROM ${table} WHERE ${key}=? AND revision=?`).bind(kind,id,contactId,kind==='transaction'?id:null,k,old[k]==null?null:String(old[k]),v==null?null:String(v),source,sourceId,sourceDate,id,revision));
 writes.push(db().prepare(`UPDATE ${table} SET ${changed.map(([k])=>`${k}=?`).join(',')},revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE ${key}=? AND revision=?`).bind(...changed.map(([,v])=>v),id,revision));
 const results=await db().batch(writes);if(!results.at(-1)?.meta.changes)throw Error('This record changed. Reload before saving.');
 const sourceKey=`${kind}:${id}`; waitUntil((async()=>{await indexPending(db(),1,false,sourceKey);for(let i=0;i<changed.length;i++){if([...allFields(transactionGroups),...allFields(propertyGroups),...allFields(buyerGroups)].find(f=>f.key===changed[i][0])?.narrative&&results[i].meta.last_row_id)await indexPending(db(),1,false,`listing_history:${results[i].meta.last_row_id}`);}})().catch(()=>console.error('Real estate indexing deferred')));
 return db().prepare(`SELECT * FROM ${table} WHERE ${key}=?`).bind(id).first<Row>();
}
const number=(v:any)=>{if(v==null||v==='')return null;const s=String(v).replace(/[$,]/g,'');return /^\d+(\.\d+)?$/.test(s)?Number(s):null};
export async function migrateExisting() {
 // DML only; migration IDs make this additive and idempotent. Original records remain intact.
 const legacy=(await db().prepare("SELECT o.*,c.lead_source FROM opportunities o JOIN contacts c ON c.id=o.contact_id WHERE NOT EXISTS(SELECT 1 FROM transactions t WHERE t.legacy_opportunity_id=o.id) AND (lower(o.type) LIKE '%seller%' OR lower(o.type) LIKE '%buyer%' OR lower(o.stage) LIKE '%seller%' OR lower(o.stage) LIKE '%buyer%') LIMIT 40").all<Row>()).results;
 for(const o of legacy){const side=/seller/i.test(o.type+' '+o.stage)?'SELLER':/buyer/i.test(o.type+' '+o.stage)?'BUYER':null;if(!side)continue;
 const status=transactionStatuses.includes(o.stage)?o.stage:/closed/i.test(o.stage)?'Closed':/lost/i.test(o.stage)?'Cancelled':/listed|active/i.test(o.stage)?'Active':/pending/i.test(o.stage)?'Pending':'Preparing';
 const candidates=(await db().prepare('SELECT * FROM properties WHERE contact_id=? AND (? IS NULL OR address=?)').bind(o.contact_id,o.property_address||null,o.property_address||null).all<Row>()).results;
 const property=candidates.length===1?candidates[0]:null;
 await db().prepare("INSERT INTO transactions(contact_id,property_id,legacy_opportunity_id,side,status,property_address,lead_source,source_system,source_record_id,legacy_values,created_at,updated_at,listing_activity_notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(legacy_opportunity_id) DO NOTHING").bind(o.contact_id,property?.id||null,o.id,side,status,o.property_address||property?.address||null,o.lead_source||null,'legacy_opportunity',String(o.id),JSON.stringify(o),o.created_at==='CURRENT_TIMESTAMP'?new Date().toISOString():o.created_at,o.updated_at==='CURRENT_TIMESTAMP'?new Date().toISOString():o.updated_at,o.notes||null).run();
 const tx=await db().prepare('SELECT * FROM transactions WHERE legacy_opportunity_id=?').bind(o.id).first<Row>();
 const v:Row={};if(status==='Closed'&&/^\d{4}-\d{2}-\d{2}$/.test(o.expected_timeframe||''))v.close_date=o.expected_timeframe;
 if(status==='Closed'&&o.source_system==='follow_up_boss'&&o.estimated_price!=null)v.sold_price=o.estimated_price;
 if(Object.keys(v).length&&tx)await saveEntity('transaction',tx.id,v,tx.revision,'migration',String(o.id));
 }
 const ps=(await db().prepare("SELECT * FROM properties WHERE revision=0 AND source_system='follow_up_boss' AND notes IS NOT NULL LIMIT 40").all<Row>()).results;
 for(const p of ps){let raw:Row={};try{raw=JSON.parse(p.notes);}catch{continue;}const mappings:Row={'Property Address':'street','Property City':'city','Property State':'state','Property Postal Code':'zip','Property Beds':'bedrooms','Property Baths':'bathrooms','Property Area':'square_footage','Property Year Built':'year_built','Property Type':'property_type','Property Subdivision':'subdivision'};const v:Row={};for(const [label,key] of Object.entries(mappings))if(raw[label])try{Object.assign(v,validated({[key as string]:raw[label]},propertyGroups))}catch{};if(Object.keys(v).length)await saveEntity('property',p.id,v,p.revision,'migration',p.external_record_id);}
 const contacts=(await db().prepare("SELECT * FROM contacts WHERE NOT EXISTS(SELECT 1 FROM buyer_profiles b WHERE b.contact_id=contacts.id) AND (lower(intent) LIKE '%buyer%' OR target_locations IS NOT NULL OR price_range IS NOT NULL OR EXISTS(SELECT 1 FROM contact_intelligence i WHERE i.contact_id=contacts.id AND lower(category) LIKE '%buyer%')) LIMIT 50").all<Row>()).results;
 for(const c of contacts){const facts=(await db().prepare("SELECT * FROM contact_intelligence WHERE contact_id=? AND status='Current' ORDER BY source_date,id").bind(c.id).all<Row>()).results;const v:Row={};for(const fact of facts){const f=allFields(buyerGroups).find(f=>f.label.toLowerCase()===String(fact.field_name).toLowerCase()||f.key===fact.field_name);if(f)try{Object.assign(v,validated({[f.key]:fact.value},buyerGroups))}catch{}}
 if(!v.target_areas_zip_codes&&c.target_locations)v.target_areas_zip_codes=c.target_locations;if(!v.loan_type&&c.financing_type)v.loan_type=c.financing_type;if(!v.price_max&&number(c.price_range)!=null)v.price_max=number(c.price_range);
 const keys=Object.keys(v);await db().prepare(`INSERT INTO buyer_profiles(contact_id,legacy_values${keys.length?','+keys.join(','):''}) VALUES(?,?${keys.map(()=>',?').join('')}) ON CONFLICT(contact_id) DO NOTHING`).bind(c.id,JSON.stringify({contact:c,facts}),...Object.values(v)).run();}
}
export async function transactionList(contactId?:number) {
 return (await db().prepare(`SELECT t.*,COALESCE(p.address,t.property_address) property_address,c.first_name||' '||c.last_name client,p.city,p.subdivision,p.bedrooms,p.bathrooms,p.square_footage,p.year_built FROM transactions t JOIN contacts c ON c.id=t.contact_id LEFT JOIN properties p ON p.id=t.property_id ${contactId?'WHERE t.contact_id=? OR EXISTS(SELECT 1 FROM transaction_contacts tc WHERE tc.transaction_id=t.id AND tc.contact_id=?)':''} ORDER BY t.updated_at DESC,t.id DESC`).bind(...(contactId?[contactId,contactId]:[])).all<Row>()).results;
}
export async function transactionDetail(id:number) {
 const transaction=await db().prepare('SELECT t.*,COALESCE(p.address,t.property_address) property_address,c.first_name||\' \'||c.last_name client FROM transactions t JOIN contacts c ON c.id=t.contact_id LEFT JOIN properties p ON p.id=t.property_id WHERE t.id=?').bind(id).first<Row>();if(!transaction)return null;
 const property=transaction.property_id?await db().prepare('SELECT * FROM properties WHERE id=?').bind(transaction.property_id).first<Row>():null;
 const history=(await db().prepare("SELECT * FROM real_estate_history WHERE (entity_type='transaction' AND entity_id=?) OR (entity_type='property' AND entity_id=?) ORDER BY id DESC").bind(id,transaction.property_id||0).all<Row>()).results;
 const links=(await db().prepare('SELECT * FROM transaction_links WHERE transaction_id=?').bind(id).all<Row>()).results;
 const files=(await db().prepare('SELECT id,name,content_type,size,created_at FROM transaction_files WHERE transaction_id=?').bind(id).all<Row>()).results;
 const contacts=(await db().prepare('SELECT c.id,c.first_name,c.last_name FROM contacts c WHERE c.id=? OR EXISTS(SELECT 1 FROM transaction_contacts tc WHERE tc.transaction_id=? AND tc.contact_id=c.id)').bind(transaction.contact_id,id).all<Row>()).results;
 const tasks=(await db().prepare('SELECT * FROM tasks WHERE id IN(SELECT record_id FROM transaction_links WHERE transaction_id=? AND kind=\'task\') OR opportunity_id=?').bind(id,transaction.legacy_opportunity_id||0).all<Row>()).results;
 const communications=(await db().prepare("SELECT id,type,occurred_at,subject,message_transcript FROM communications WHERE id IN(SELECT record_id FROM transaction_links WHERE transaction_id=? AND kind='communication')").bind(id).all<Row>()).results;
 return {transaction,property,history,links,files,contacts,tasks,communications};
}
