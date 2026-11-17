export const leadProviders = ['website','facebook','zillow','homes','generic','email'] as const;
export type Lead = Record<string,any>;
export function leadPhone(v:unknown) {const s=String(v||'').replace(/\D/g,'');return s.length===10?`+1${s}`:s.length>=11&&s.length<=15?`+${s}`:null;}
export function redactLeadPayload(v:any):any {if(Array.isArray(v))return v.map(redactLeadPayload);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,/token|secret|password|authorization|api.?key/i.test(k)?'[redacted]':redactLeadPayload(x)]));return v;}
export function normalizeLead(provider:string,input:Lead):Lead {
 if(!leadProviders.includes(provider as any))throw Error('Unsupported adapter');
 const answers=Object.fromEntries((Array.isArray(input.field_data)?input.field_data:[]).map((x:Lead)=>[x.name,Array.isArray(x.values)?x.values[0]:x.value]));
 const v={...input,...answers};const full=String(v.display_name||v.full_name||v.name||'').trim();
 const email=String(v.email||v.email_address||'').trim().toLowerCase();if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Invalid email');
 const phone=leadPhone(v.phone||v.phone_number);if((v.phone||v.phone_number)&&!phone)throw Error('Invalid phone');
 if(!phone&&!email)throw Error('A valid phone or email is required');
 const intent=String(v.buyer_or_seller_intent||v.intent||v.inquiry_type||'Unknown').toLowerCase();
 const property=String(v.source_property_address||v.property_address||v.property?.address||'').slice(0,500);
 const buyer=/buyer|buy|showing/.test(intent),seller=/seller|sell/.test(intent);
 const subtype=seller?'Seller Internet Lead':provider==='facebook'&&property?'Facebook Property Lead':buyer?({website:'Website Buyer Lead',facebook:'Facebook General Buyer Lead',zillow:'Zillow Buyer Lead',homes:'Homes.com Buyer Lead'} as Lead)[provider]||'Unknown Internet Lead':'Unknown Internet Lead';
 const source=({website:'Website',facebook:property?'Facebook - Property Lead':buyer?'Facebook - Buyer Lead':'Facebook',zillow:'Zillow',homes:'Homes.com'} as Lead)[provider]||'Other Internet Lead';
 const received=String(v.received_at||v.created_time||new Date().toISOString());if(!Number.isFinite(Date.parse(received)))throw Error('Invalid received timestamp');
 const external=String(v.external_lead_id||v.leadgen_id||v.website_submission_id||v.message_id||v.id||'').slice(0,200);if(!external)throw Error('A stable external_lead_id is required for retry deduplication');
 return {external_lead_id:external,provider,source,subtype,first_name:String(v.first_name||full.split(/\s+/)[0]||'Unknown').slice(0,120),last_name:String(v.last_name||full.split(/\s+/).slice(1).join(' ')||'').slice(0,120),display_name:full||[v.first_name,v.last_name].filter(Boolean).join(' '),phone,email:email||null,message:String(v.message||v.inquiry||'').slice(0,10000),notes:String(v.notes||'').slice(0,10000),property,campaign:String(v.source_campaign||v.campaign_name||v.campaign_id||'').slice(0,200),intent:seller?'Seller':buyer?'Buyer':'Unknown',received_at:new Date(received).toISOString(),raw_payload:redactLeadPayload(input),metadata:redactLeadPayload({source_name:v.source_name,source_ad:v.source_ad||v.ad_id,source_form:v.source_form||v.form_id,source_property_id:v.source_property_id||v.property_id,source_property_url:v.source_property_url||v.property_url,source_metadata:v.source_metadata,answers}),sms_consent:v.sms_consent===true,email_consent:v.email_consent===true};
}
export function parseLeadEmail(body:string):Lead {
 const field=(name:string)=>body.match(new RegExp(`(?:^|\\n)\\s*(?:${name})\\s*:\\s*([^\\n]+)`,'i'))?.[1]?.trim();
 return {name:field('Name|Full Name'),first_name:field('First Name'),last_name:field('Last Name'),email:field('Email|Email Address'),phone:field('Phone|Phone Number'),property_address:field('Property|Property Address'),intent:field('Intent|Inquiry Type'),message:field('Message|Inquiry'),notes:body.slice(0,10000)};
}
