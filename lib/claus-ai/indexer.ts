import { embed, embeddingConfig } from './embeddings';
import { allFields, buyerGroups, propertyGroups, transactionGroups } from '../real-estate-fields';
import { AiBudgetError } from './budget';
import { chunksOf, redactSecrets } from './chunks.mjs';

type Row = Record<string, any>;
const hash = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))), b => b.toString(16).padStart(2, '0')).join('');
async function source(db: D1Database, kind: string, id: number) {
  if (kind === 'communication') return db.prepare('SELECT id,contact_id,occurred_at,subject,message_transcript,ai_summary,type,author_name,participants FROM communications WHERE id=?').bind(id).first<Row>();
  if (kind === 'note') return db.prepare('SELECT id,contact_id,created_at occurred_at,body FROM notes WHERE id=?').bind(id).first<Row>();
  if (kind === 'intelligence') return db.prepare("SELECT id,contact_id,source_date occurred_at,category,field_name,value,status FROM contact_intelligence WHERE id=? AND status='Current'").bind(id).first<Row>();
  if(kind==='transaction') return db.prepare("SELECT t.*,t.updated_at occurred_at,p.address,p.id property_id,c.lead_source FROM transactions t LEFT JOIN properties p ON p.id=t.property_id LEFT JOIN contacts c ON c.id=t.contact_id WHERE t.id=?").bind(id).first<Row>();
  if(kind==='property') return db.prepare("SELECT p.*,p.updated_at occurred_at,(SELECT id FROM transactions t WHERE t.property_id=p.id ORDER BY t.updated_at DESC LIMIT 1) transaction_id,(SELECT side FROM transactions t WHERE t.property_id=p.id ORDER BY t.updated_at DESC LIMIT 1) side,(SELECT json_group_array(id) FROM transactions t WHERE t.property_id=p.id) transaction_ids,(SELECT lead_source FROM contacts c WHERE c.id=p.contact_id) lead_source FROM properties p WHERE p.id=?").bind(id).first<Row>();
  if(kind==='buyer_profile') return db.prepare("SELECT b.*,b.contact_id id,b.updated_at occurred_at,'BUYER' side,(SELECT lead_source FROM contacts c WHERE c.id=b.contact_id) lead_source FROM buyer_profiles b WHERE b.contact_id=?").bind(id).first<Row>();
  if(kind==='listing_history') return db.prepare("SELECT h.*,h.changed_at occurred_at,(SELECT property_id FROM transactions t WHERE t.id=h.transaction_id) property_id,(SELECT property_address FROM transactions t WHERE t.id=h.transaction_id) property_address,(SELECT side FROM transactions t WHERE t.id=h.transaction_id) side,(SELECT status FROM transactions t WHERE t.id=h.transaction_id) status,(SELECT lead_source FROM contacts c WHERE c.id=h.contact_id) lead_source FROM real_estate_history h WHERE h.id=?").bind(id).first<Row>();
  return null;
}
function content(kind: string, row: Row) {
  if(['transaction','property','buyer_profile'].includes(kind)) {
    const groups=kind==='transaction'?transactionGroups:kind==='property'?propertyGroups:buyerGroups;
    return redactSecrets(allFields(groups).filter(f=>f.narrative&&row[f.key]).map(f=>`${f.label}: ${row[f.key]}`).join('\n'));
  }
  if(kind==='listing_history') {const f=[...allFields(transactionGroups),...allFields(propertyGroups),...allFields(buyerGroups)].find(f=>f.key===row.field_name);return f?.narrative?redactSecrets(`${f.label}: ${row.old_value||'Not recorded'} → ${row.new_value||'Removed'}; ${row.source}; ${row.changed_by}`):'';}
  return redactSecrets(kind === 'communication' ? [row.subject, row.message_transcript, row.ai_summary].filter(Boolean).join('\n') : kind === 'note' ? row.body : `${row.category || ''}: ${row.field_name || ''}: ${row.value || ''}`);
}
const fingerprint = (kind: string,row: Row) => JSON.stringify([content(kind,row),row.contact_id,row.occurred_at,row.type,row.author_name,row.participants,row.property_id,row.property_address,row.side,row.status,row.lead_source,row.transaction_id]);
export async function indexPending(db: D1Database, limit = 1, includeFailed = false, sourceKey?: string) {
  const config = embeddingConfig();
  if (!config.ready) return { indexed: 0, updated: 0, failed: 0, processed: 0 };
  const obsolete = await db.prepare('SELECT 1 FROM claus_ai_embeddings WHERE provider<>? OR model<>? LIMIT 1').bind(config.provider,config.model).first();
  if (obsolete) return { indexed: 0, updated: 0, failed: 0, processed: 0 };
  const pending = (await db.prepare(`SELECT source_kind,source_id FROM claus_ai_index_queue WHERE status IN (${includeFailed ? "'pending','failed'" : "'pending'"}) ${sourceKey ? 'AND source_key=?' : ''} ORDER BY updated_at,source_key LIMIT ?`).bind(...(sourceKey ? [sourceKey] : []),Math.min(limit, 8)).all<Row>()).results;
  let indexed = 0, updated = 0, failed = 0;
  for (const entry of pending) {
    const { source_kind: kind, source_id: id } = entry;
    const row = await source(db, kind, id);
    const text = row && content(kind, row);
    if (text && text.length > 28000) {
      failed++;
      await db.prepare("UPDATE claus_ai_index_queue SET status='failed',error='Source exceeds safe 32-chunk limit; split before indexing' WHERE source_key=?").bind(`${kind}:${id}`).run();
      continue;
    }
    const parts = text ? chunksOf(text) : [];
    const old = await db.prepare('SELECT count(*) n FROM claus_ai_embeddings WHERE source_kind=? AND source_id=? AND provider=? AND model=?').bind(kind,id,config.provider,config.model).first<{n:number}>();
    if (!parts.length) {
      await db.batch([db.prepare('DELETE FROM claus_ai_embeddings WHERE source_kind=? AND source_id=?').bind(kind,id),db.prepare("DELETE FROM claus_ai_index_queue WHERE source_key=?").bind(`${kind}:${id}`)]);
      continue;
    }
    if (!row || !text) continue;
    const digest = await hash(fingerprint(kind,row));
    const existing = await db.prepare('SELECT count(*) n FROM claus_ai_embeddings WHERE source_kind=? AND source_id=? AND provider=? AND model=? AND content_hash=?').bind(kind,id,config.provider,config.model,digest).first<{n:number}>();
    if (Number(existing?.n) === parts.length) {
      await db.prepare("UPDATE claus_ai_index_queue SET status='done',error=NULL WHERE source_key=?").bind(`${kind}:${id}`).run();
      continue;
    }
    try {
      const vectors: number[][] = [];
      for (let i = 0; i < parts.length; i += 8) vectors.push(...await embed(parts.slice(i,i+8),'semantic_index',`${kind}:${id}`));
      const current = await source(db,kind,id);
      if (!current || await hash(fingerprint(kind,current)) !== digest) continue; // changed during provider request; trigger has already queued it again
      let sender: string | null = null, recipient: string | null = null, thread: string | null = null;
      if (kind === 'communication') {
        sender = String(row.author_name || '') || null;
        try { const p = JSON.parse(row.participants || '{}'); recipient = Array.isArray(p.recipients) ? p.recipients.join(', ') : String(p.recipient_name || p.recipient || '') || null; thread = String(p.thread_id || p.threadId || p.conversationId || '') || null; } catch { /* optional metadata */ }
      }
      const writes = [db.prepare('DELETE FROM claus_ai_embeddings WHERE source_kind=? AND source_id=?').bind(kind,id)];
      for (let i=0;i<parts.length;i++) writes.push(db.prepare('INSERT INTO claus_ai_embeddings (source_kind,source_id,contact_id,occurred_at,content_hash,provider,model,vector_json,chunk_index,content,source_type,sender,recipient,thread_id,metadata_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(kind,id,row.contact_id,row.occurred_at||null,digest,config.provider,config.model,JSON.stringify(vectors[i]),i,parts[i],kind === 'communication' ? row.type : kind,sender,recipient,thread,JSON.stringify({transaction_ids:row.transaction_ids?JSON.parse(row.transaction_ids):[],transaction_id:kind==='transaction'?id:row.transaction_id||null,contact_id:row.contact_id,property_id:row.property_id|| (kind==='property'?id:null),property_address:row.property_address||row.address||null,side:row.side||null,status:row.status||null,date:row.occurred_at,source_type:kind,source_record_id:id,field:row.field_name||'narrative',transaction_status:row.status||null,lead_source:row.lead_source||null})));
      writes.push(db.prepare("UPDATE claus_ai_index_queue SET status='done',error=NULL,updated_at=CURRENT_TIMESTAMP WHERE source_key=?").bind(`${kind}:${id}`));
      await db.batch(writes);
      indexed++; if (old?.n) updated++;
    } catch (error) {
      if (error instanceof AiBudgetError) throw error; // pause, retaining pending work for another day
      failed++;
      await db.prepare("UPDATE claus_ai_index_queue SET status='failed',error=?,updated_at=CURRENT_TIMESTAMP WHERE source_key=?").bind(error instanceof Error ? error.message.slice(0,160) : 'Embedding failed',`${kind}:${id}`).run();
    }
  }
  return { indexed, updated, failed, processed: pending.length };
}
export async function indexStatus(db: D1Database) {
  const c = embeddingConfig();
  const row = await db.prepare("SELECT sum(status='pending') pending,sum(status='failed') failed,max(CASE WHEN status='failed' THEN error END) last_error FROM claus_ai_index_queue").first<Row>();
  const models = (await db.prepare('SELECT provider,model,count(*) chunks,count(DISTINCT source_kind||\':\'||source_id) records,max(indexed_at) last_indexed_at FROM claus_ai_embeddings GROUP BY provider,model').all<Row>()).results;
  const active = models.find(x => x.provider===c.provider && x.model===c.model);
  const stale = models.some(x => x.provider!==c.provider || x.model!==c.model);
  const sources=(await db.prepare("SELECT source_kind,sum(status='pending') pending,sum(status='failed') failed,sum(status='done') AS indexed_count FROM claus_ai_index_queue GROUP BY source_kind").all<Row>()).results;
  const chunks=(await db.prepare("SELECT source_kind,count(*) chunks FROM claus_ai_embeddings GROUP BY source_kind").all<Row>()).results;
  for(const source of sources) {source.indexed=Number(source.indexed_count||0);source.chunks=chunks.find(x=>x.source_kind===source.source_kind)?.chunks||0;}
  return { sources:['transaction','property','buyer_profile','listing_history','communication','note','intelligence'].map(kind=>sources.find(s=>s.source_kind===kind)||{source_kind:kind,pending:0,failed:0,indexed:0,chunks:0}),provider:c.provider||'Not configured',model:c.model||'Not configured',keyConfigured:!!c.key, status:!c.ready ? 'Not configured' : stale ? 'Needs rebuild' : row?.failed ? 'Error' : row?.pending ? active ? 'Indexing' : 'Ready' : 'Up to date', pending:Number(row?.pending||0),failed:Number(row?.failed||0),lastError:row?.last_error||null,indexedRecords:Number(active?.records||0),indexedChunks:Number(active?.chunks||0),lastIndexedAt:active?.last_indexed_at||null,needsRebuild:stale };
}
