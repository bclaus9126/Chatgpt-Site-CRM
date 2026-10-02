import {allFields,buyerGroups,transactionGroups,propertyGroups} from '../real-estate-fields';
import type {Evidence} from './retrieval';
type Row=Record<string,any>;
const fields=[...allFields(transactionGroups),...allFields(propertyGroups),...allFields(buyerGroups)];
const numeric=(s:string)=>Number(s.replace(/[,$]/g,''))*(/k$/i.test(s)?1000:1);
export async function realEstateRetrieval(db:D1Database,question:string,ids:number[]) {
 const q=question.toLowerCase();if(!/\b(transactions?|listings?|listed|sold|showings?|offers?|pre.?approv\w*|price reductions?|list.to.sale|buyers?|neighborhoods?|bedrooms?|square footage|one.story|large lots?|under contract|financing|closed)\b/.test(q))return null;
 const buyer=/\b(?:buyers?|one.story|pre.?approv\w*|large lots?)\b/.test(q)&&! /\b(?:listings?|sellers?|sold|transactions?)\b/.test(q);
 const where:string[]=[],values:unknown[]=[];const scope=ids.length?` AND ${buyer?'b.contact_id':'t.contact_id'} IN(${ids.map(()=>'?').join(',')})`:'';
 if(!buyer&&/seller|listing/.test(q))where.push("t.side='SELLER'");if(!buyer&&!/listing|seller/.test(q)&&/buyer/.test(q))where.push("t.side='BUYER'");
 if(!buyer&&/under contract/.test(q))where.push("(t.contract_date IS NOT NULL OR t.status LIKE 'Under Contract%' OR t.status IN('Pending','Closed'))");
 if(!buyer&&/closed|sold|list.to.sale/.test(q))where.push("t.status='Closed'");
 if(!buyer&&/this year/.test(q)){where.push('t.close_date>=? AND t.close_date<?');const yr=new Intl.DateTimeFormat('en',{timeZone:'America/Chicago',year:'numeric'}).format(new Date());values.push(yr+'-01-01',(Number(yr)+1)+'-01-01');}
 if(buyer){
  const amount=q.match(/(?:under|below|less than|over|above|more than|up to)\s*\$?([\d,]+(?:\.\d+)?)(k)?/);if(amount){const value=numeric(amount[1])*(amount[2]?1000:1);const field=/pre.?approv/.test(q)?'pre_approval_amount':'price_max';const op=/over|above|more than/.test(amount[0])?'>':/up to/.test(amount[0])?'<=':'<';where.push(`b.${field}${op}?`);values.push(value);}
  if(/one.story|single.story/.test(q))where.push("(b.one_story_preference=1 OR lower(coalesce(b.must_haves,'')) LIKE '%one story%' OR lower(coalesce(b.must_haves,'')) LIKE '%single story%')");
  if(/large lot/.test(q))where.push("lower(coalesce(b.lot_size_preference,'')||' '||coalesce(b.must_haves,'')) LIKE '%large%'");
  if(/sell.*before.*buy|need.*sell/.test(q))where.push('b.need_to_sell_existing_home_first=1');
  const days=q.match(/(?:more than|over)\s*(\d+)\s*days/);if(days){where.push('b.first_contact_date IS NOT NULL AND julianday(\'now\')-julianday(b.first_contact_date)>?');values.push(Number(days[1]));}
  if(/past buyers?/.test(q))where.push("EXISTS(SELECT 1 FROM transactions z WHERE z.contact_id=b.contact_id AND z.side='BUYER' AND z.status='Closed')");
 }else{
  const show=q.match(/(?:more than|over|above)\s*(\d+)\s*showings/);if(show){where.push('t.number_of_showings>?');values.push(Number(show[1]));}else if(/lots of showings|lot of showings/.test(q)){where.push('t.number_of_showings>10');}
  if(/no offers|zero offers/.test(q))where.push('t.number_of_offers=0');
  if(/completed repairs|repairs.*before listing/.test(q))where.push("t.repairs_expected_complete_date IS NOT NULL AND t.listing_live_date IS NOT NULL AND t.repairs_expected_complete_date<=t.listing_live_date");
 }
 const clause=where.length?' AND '+where.join(' AND '):'';
 const records=(await db.prepare(buyer?`SELECT b.*,b.contact_id id,c.first_name,c.last_name,c.lead_source FROM buyer_profiles b JOIN contacts c ON c.id=b.contact_id WHERE 1=1${clause}${scope} ORDER BY c.last_name,c.first_name LIMIT 1000`:`SELECT t.*,c.first_name,c.last_name,p.bedrooms,p.bathrooms,p.square_footage,p.year_built,p.subdivision,p.city,p.lot_size,p.key_features,p.description FROM transactions t JOIN contacts c ON c.id=t.contact_id LEFT JOIN properties p ON p.id=t.property_id WHERE 1=1${clause}${scope} ORDER BY t.created_at DESC LIMIT 1000`).bind(...values,...ids).all<Row>()).results;
 const evidence:Evidence[]=records.slice(0,30).map(r=>({kind:buyer?'buyer_profile':'transaction',id:Number(r.id),contactId:Number(r.contact_id),contact:`${r.first_name} ${r.last_name}`,date:r.close_date||r.updated_at,sourceUrl:buyer?`/?contact=${r.contact_id}&profile=buyer`:`/?transaction=${r.id}`,excerpt:[r.property_address,r.status,...fields.filter(f=>r[f.key]!=null).map(f=>`${f.label}: ${r[f.key]}`)].filter(Boolean).join(' · ').slice(0,500)}));
 const measure= /price reductions?/.test(q)?'number_of_price_reductions':/days on market|fastest|shortest/.test(q)?'days_on_market':/net proceeds/.test(q)?'final_net_proceeds':/concessions/.test(q)?'seller_concessions':/showings/.test(q)?buyer?'showings_to_date':'number_of_showings':/offers/.test(q)?buyer?'offers_written':'number_of_offers':null;
 let aggregate:Row|null=null;
 if(/average|how many|common|highest|ratio|shortest|fastest/.test(q)){
 const finite=measure?records.map(r=>r[measure]).filter(v=>v!=null&&Number.isFinite(Number(v))).map(Number):[];
 aggregate={kind:'real_estate_aggregate',id:0,total_matching_records:records.length,coverage_limit:1000,metric:measure,sample_count:finite.length,average:finite.length?finite.reduce((a,b)=>a+b,0)/finite.length:null};
 if(/ratio/.test(q)){const denominator=/original/.test(q)?'original_list_price':'current_price';const ratios=records.filter(r=>r.sold_price!=null&&r[denominator]>0).map(r=>({id:r.id,property:r.property_address,ratio:r.sold_price/r[denominator]})).sort((a,b)=>b.ratio-a.ratio);aggregate={...aggregate,ratio_denominator:denominator,ratios:ratios.slice(0,10),average_ratio:ratios.length?ratios.reduce((a,b)=>a+b.ratio,0)/ratios.length:null};}
 if(/neighborhood/.test(q)&&measure){const grouped:Row={};for(const r of records)if(r.subdivision&&r[measure]!=null){(grouped[r.subdivision] ||= []).push(Number(r[measure]));}aggregate.neighborhood_averages=Object.entries(grouped).map(([name,v])=>({name,count:(v as number[]).length,average:(v as number[]).reduce((a,b)=>a+b,0)/(v as number[]).length})).sort((a,b)=>a.average-b.average);}
 }
 return {records:[...(aggregate?[aggregate]:[]),...records.slice(0,30).map(r=>({kind:buyer?'buyer_profile':'transaction',...r,structured_values:Object.fromEntries(fields.filter(f=>r[f.key]!=null).map(f=>[f.label,r[f.key]])),body:fields.filter(f=>f.narrative&&r[f.key]).map(f=>`${f.label}: ${r[f.key]}`).join('\n')}))],evidence,tools:[buyer?'query_buyer_profiles':'query_real_estate_transactions',...(aggregate?['aggregate_real_estate']:[]),...(/feedback|concern|notes|objection|context|characteristics|must.have|deal.breaker|common/.test(q)?['real_estate_narrative_search']:[])],contactIds:[...new Set(records.map(r=>Number(r.contact_id)))],transactionIds:buyer?[]:records.map(r=>Number(r.id)),totalMatches:records.length,resolvedContactId:ids.length===1?ids[0]:undefined,sourceKinds:buyer?['buyer_profile','listing_history']:['transaction','property','listing_history'],thresholdNote:/lots of showings/.test(q)?'Lots of showings interpreted as more than 10; number of offers must explicitly equal zero.':undefined};
}
