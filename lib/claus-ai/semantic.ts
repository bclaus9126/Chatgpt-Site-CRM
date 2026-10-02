import { cosine, embed, embeddingConfig } from './embeddings';
import type { Evidence } from './retrieval';
type Row = Record<string, any>;
const termsOf = (question:string) => {
  const stop = new Set(['who','what','which','was','were','did','say','said','mentioned','mention','about','wanting','wanted','with','before','after','from','past','client','clients','house','home','their','them','the','and','or']);
  return [...new Set((question.toLowerCase().match(/[a-z]{4,}/g)||[]).filter(word=>!stop.has(word)).map(word=>word.replace(/(?:ing|ed|s)$/,'')).filter(word=>word.length>=4))].slice(0,5);
};
const lexicalScore = (question:string,content:string) => {
  const terms=termsOf(question),text=content.toLowerCase();
  return Math.min(0.42,terms.filter(word=>text.includes(word)).length*0.18);
};

// D1 retains source linked chunks and vectors; bounded cosine ranking needs no vector service.
export async function semanticSearch(db: D1Database, question: string, contactIds: number[], pastClientsOnly: boolean, cutoff: string, transactionIds: number[] = [], sourceKinds: string[] = []): Promise<{ records: Row[]; evidence: Evidence[] }> {
  const c = embeddingConfig();
  if (!c.ready) return {records:[],evidence:[]};
  const indexed = await db.prepare('SELECT 1 FROM claus_ai_embeddings WHERE provider=? AND model=? LIMIT 1').bind(c.provider,c.model).first();
  if (!indexed) return {records:[],evidence:[]};
  const [queryVector] = await embed([question]);
  const where = ['e.provider=?','e.model=?','e.occurred_at>=?'];
  const args: unknown[] = [c.provider,c.model,cutoff];
  if (contactIds.length) { where.push(`e.contact_id IN (${contactIds.map(()=>'?').join(',')})`); args.push(...contactIds); }
  if(transactionIds.length){where.push(`(CAST(json_extract(e.metadata_json,'$.transaction_id') AS INTEGER) IN (${transactionIds.map(()=>'?').join(',')}) OR EXISTS(SELECT 1 FROM json_each(json_extract(e.metadata_json,'$.transaction_ids')) j WHERE j.value IN (${transactionIds.map(()=>'?').join(',')})))`);args.push(...transactionIds,...transactionIds);}
  if(sourceKinds.length){where.push(`e.source_kind IN (${sourceKinds.map(()=>'?').join(',')})`);args.push(...sourceKinds);}
  if (/\b(?:seller|listing)s?\b/i.test(question)) where.push("(e.source_kind NOT IN ('transaction','buyer_profile') OR json_extract(e.metadata_json,'$.side')='SELLER')");
  if (/\bbuyers?\b/i.test(question)) where.push("(e.source_kind<>'transaction' OR json_extract(e.metadata_json,'$.side')='BUYER')");
  if (pastClientsOnly) where.push("lower(c.relationship) IN ('past client','past clients')");
  const candidates = (await db.prepare(`SELECT e.source_kind,e.source_id,e.contact_id,e.occurred_at,e.chunk_index,e.content,e.vector_json,e.source_type,e.sender,e.recipient,e.thread_id,e.metadata_json,c.first_name,c.last_name FROM claus_ai_embeddings e JOIN contacts c ON c.id=e.contact_id WHERE ${where.join(' AND ')} ORDER BY e.id DESC LIMIT 3000`).bind(...args).all<Row>()).results;
  const ranked = candidates.map(row=>{let vector:number[]=[];try{vector=JSON.parse(row.vector_json);}catch{}const similarity=cosine(queryVector,vector);return {row,similarity,score:similarity+lexicalScore(question,String(row.content||''))};}).filter(x=>x.similarity>=0.25).sort((a,b)=>b.score-a.score);
  const records:Row[] = [],evidence:Evidence[] = []; const seen=new Set<string>();
  for (const {row} of ranked) {
    const key=`${row.source_kind}:${row.source_id}`;
    if (seen.has(key)) continue;
    const table = row.source_kind==='transaction'?'transactions':row.source_kind==='property'?'properties':row.source_kind==='buyer_profile'?'buyer_profiles':row.source_kind==='listing_history'?'real_estate_history':row.source_kind==='note' ? 'notes' : row.source_kind==='intelligence' ? 'contact_intelligence' : 'communications';
    const source = await db.prepare(`SELECT ${row.source_kind==='buyer_profile'?'contact_id id,contact_id':'id,contact_id'} FROM ${table} WHERE ${row.source_kind==='buyer_profile'?'contact_id':'id'}=?`).bind(row.source_id).first<Row>();
    if (!source || row.source_kind==='intelligence' && !(await db.prepare("SELECT 1 FROM contact_intelligence WHERE id=? AND status='Current'").bind(row.source_id).first())) continue;
    seen.add(key);
    const kind=row.source_kind==='intelligence'?'intelligence':row.source_kind;
    const excerpt=String(row.content||'').slice(0,380);
    records.push({kind,id:source.id,contact_id:source.contact_id,occurred_at:row.occurred_at,type:row.source_type,author_name:row.sender,recipient:row.recipient,thread_id:row.thread_id,message_transcript:excerpt,body:excerpt,first_name:row.first_name,last_name:row.last_name});
    evidence.push({kind,id:Number(source.id),contactId:Number(source.contact_id),contact:`${row.first_name} ${row.last_name}`,date:row.occurred_at,excerpt,sourceType:row.source_type||kind,sender:row.sender,recipient:row.recipient,threadId:row.thread_id,chunkIndex:row.chunk_index,sourceUrl:['transaction','listing_history'].includes(kind)&&JSON.parse(row.metadata_json||'{}').transaction_id?`/?transaction=${JSON.parse(row.metadata_json||'{}').transaction_id}`:kind==='property'?`/?contact=${source.contact_id}`:kind==='buyer_profile'?`/?contact=${source.contact_id}&profile=buyer`:undefined});
    if (records.length===10) break;
  }
  return {records,evidence};
}
