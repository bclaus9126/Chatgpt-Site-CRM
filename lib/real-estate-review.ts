import {env} from 'cloudflare:workers';
import {allFields,buyerGroups,propertyGroups,transactionGroups} from './real-estate-fields';
import {saveEntity} from './real-estate';
type Row=Record<string,any>;
export async function applyReviewedRealEstate(s:Row,contactId:number,source:string,sourceId:number,sourceDate:string,transactionId?:number){
 const key=String(s.field_name||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/_$/,'');
 const alias:Row={buyer_price_max:'price_max',buyer_price_min:'price_min',buyer_price_ceiling:'price_ceiling',buyer_bedrooms:'bedrooms_needed',buyer_bathrooms:'bathrooms_needed',target_area:'target_areas_zip_codes',target_locations:'target_areas_zip_codes',price_maximum:'price_max',seller_price:'current_price',seller_price_expectation:'price_expectation',mortgage_balance:'mortgage_balance',listing_price:'current_price',repairs_complete_date:'repairs_expected_complete_date',repair_complete_date:'repairs_expected_complete_date'};
 const canonical=alias[key]||key;
 const find=(gs:any)=>allFields(gs).find(f=>f.key===canonical||f.label.toLowerCase().replace(/[^a-z0-9]+/g,'_')===canonical);
 const buyer=find(buyerGroups);if(buyer&&(/BUYER/.test(s.category)||!find(transactionGroups)&&!find(propertyGroups))){await env.DB.prepare('INSERT INTO buyer_profiles(contact_id) VALUES(?) ON CONFLICT DO NOTHING').bind(contactId).run();const r=await env.DB.prepare('SELECT * FROM buyer_profiles WHERE contact_id=?').bind(contactId).first<Row>();await saveEntity('buyer_profile',contactId,{[buyer.key]:s.field_value},r!.revision,source,String(sourceId),sourceDate);return true;}
 const field=find(transactionGroups)||find(propertyGroups);if(!field)return false;
 const txs=(await env.DB.prepare("SELECT * FROM transactions WHERE (contact_id=? OR EXISTS(SELECT 1 FROM transaction_contacts tc WHERE tc.transaction_id=transactions.id AND tc.contact_id=?)) AND (? IS NULL OR id=?) AND (? IS NOT NULL OR status NOT IN('Closed','Withdrawn','Expired','Cancelled'))").bind(contactId,contactId,transactionId||null,transactionId||null,transactionId||null).all<Row>()).results;
 if(!txs.length&&!transactionId)return false;
 if(txs.length!==1)throw Error('Choose the target transaction on its Transactions page before accepting this field.');
 const tx=txs[0];if(find(transactionGroups))await saveEntity('transaction',tx.id,{[field.key]:s.field_value},tx.revision,source,String(sourceId),sourceDate);
 else {const p=await env.DB.prepare('SELECT * FROM properties WHERE id=?').bind(tx.property_id).first<Row>();if(!p)throw Error('Link a property before accepting this field.');await saveEntity('property',p.id,{[field.key]:s.field_value},p.revision,source,String(sourceId),sourceDate);}
 await env.DB.prepare("INSERT INTO transaction_links(transaction_id,kind,record_id) VALUES(?,'communication',?) ON CONFLICT DO NOTHING").bind(tx.id,sourceId).run();return true;
}
