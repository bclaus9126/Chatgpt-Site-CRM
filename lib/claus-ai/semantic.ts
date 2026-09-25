import { cosine, embed, embeddingConfig } from "./embeddings";
import type { Evidence } from "./retrieval";
type Row = Record<string, any>;
const short = (s: unknown) => String(s || "").replace(/\s+/g, " ").slice(0, 380);

// D1 stores vectors as a compact derived index. At this CRM's scale, bounded
// cosine ranking in the Worker avoids a separate vector service.
export async function semanticSearch(db: D1Database, question: string, contactIds: number[], pastClientsOnly: boolean, cutoff: string): Promise<{ records: Row[]; evidence: Evidence[]; }> {
  const c = embeddingConfig();
  if (!c.ready) return { records: [], evidence: [] };
  const indexed = await db.prepare("SELECT 1 FROM claus_ai_embeddings WHERE provider=? AND model=? LIMIT 1").bind(c.provider, c.model).first();
  if (!indexed) return { records: [], evidence: [] };
  const [queryVector] = await embed([question]);
  const where = ["e.provider=?", "e.model=?", "e.occurred_at>=?"];
  const args: unknown[] = [c.provider, c.model, cutoff];
  if (contactIds.length) { where.push(`e.contact_id IN (${contactIds.map(() => "?").join(",")})`); args.push(...contactIds); }
  if (pastClientsOnly) where.push("lower(c.relationship) IN ('past client','past clients')");
  const candidates = (await db.prepare(`SELECT e.source_kind,e.source_id,e.contact_id,e.occurred_at,e.vector_json,c.first_name,c.last_name FROM claus_ai_embeddings e JOIN contacts c ON c.id=e.contact_id WHERE ${where.join(" AND ")} ORDER BY e.id DESC LIMIT 3000`).bind(...args).all<Row>()).results;
  const hits = candidates.map(row => {
    let vector: number[] = [];
    try { vector = JSON.parse(row.vector_json); } catch { /* old malformed vector */ }
    return { row, score: cosine(queryVector, vector) };
  }).filter(x => x.score >= 0.25).sort((a, b) => b.score - a.score).slice(0, 10);
  const records: Row[] = [], evidence: Evidence[] = [];
  for (const { row } of hits) {
    const source = row.source_kind === "note"
      ? await db.prepare("SELECT id,contact_id,created_at,body FROM notes WHERE id=?").bind(row.source_id).first<Row>()
      : await db.prepare("SELECT id,contact_id,type,direction,occurred_at,subject,message_transcript,ai_summary FROM communications WHERE id=?").bind(row.source_id).first<Row>();
    if (!source) continue;
    const kind = row.source_kind === "note" ? "note" : "communication";
    const excerpt = short(kind === "note" ? source.body : source.ai_summary || source.message_transcript || source.subject);
    records.push({ kind, ...source, first_name: row.first_name, last_name: row.last_name, message_transcript: short(source.message_transcript), body: short(source.body) });
    evidence.push({ kind, id: Number(source.id), contactId: Number(source.contact_id), contact: `${row.first_name} ${row.last_name}`, date: source.occurred_at || source.created_at, excerpt });
  }
  return { records, evidence };
}
