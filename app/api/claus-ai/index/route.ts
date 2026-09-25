import { authorizeCrmOwner } from "@/lib/crm-auth";
import { env } from "cloudflare:workers";
import { embed, embeddingConfig } from "@/lib/claus-ai/embeddings";

export async function POST(request: Request) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  const config = embeddingConfig();
  if (!config.ready) return Response.json({ error: "Configure EMBEDDING_PROVIDER, EMBEDDING_MODEL and its server-side key first." }, { status: 409 });
  try {
    const { reset } = await request.json() as { reset?: boolean };
    if (reset) await env.DB.prepare("DELETE FROM claus_ai_embeddings WHERE provider=? AND model=?").bind(config.provider, config.model).run();
    const candidates = (await env.DB.prepare(`
      SELECT 'communication' source_kind,m.id source_id,m.contact_id,m.occurred_at,substr(coalesce(m.ai_summary,'') || ' ' || coalesce(m.subject,'') || ' ' || coalesce(m.message_transcript,''),1,1100) content
      FROM communications m WHERE length(trim(coalesce(m.ai_summary,'') || coalesce(m.message_transcript,'') || coalesce(m.subject,'')))>0
      AND NOT EXISTS (SELECT 1 FROM claus_ai_embeddings e WHERE e.source_kind='communication' AND e.source_id=m.id AND e.provider=? AND e.model=?)
      UNION ALL
      SELECT 'note',n.id,n.contact_id,n.created_at,substr(n.body,1,1100)
      FROM notes n WHERE length(trim(n.body))>0
      AND NOT EXISTS (SELECT 1 FROM claus_ai_embeddings e WHERE e.source_kind='note' AND e.source_id=n.id AND e.provider=? AND e.model=?)
      ORDER BY source_kind,source_id LIMIT 20
    `).bind(config.provider, config.model, config.provider, config.model).all<Record<string, any>>()).results;
    if (candidates.length) {
      const vectors = await embed(candidates.map(c => String(c.content)));
      const statements = await Promise.all(candidates.map(async (c, i) => {
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(c.content));
        const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
        return env.DB.prepare("INSERT INTO claus_ai_embeddings (source_kind,source_id,contact_id,occurred_at,content_hash,provider,model,vector_json) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(source_kind,source_id,provider,model) DO UPDATE SET contact_id=excluded.contact_id,occurred_at=excluded.occurred_at,content_hash=excluded.content_hash,vector_json=excluded.vector_json")
          .bind(c.source_kind, c.source_id, c.contact_id, c.occurred_at, hash, config.provider, config.model, JSON.stringify(vectors[i]));
      }));
      await env.DB.batch(statements);
    }
    const remaining = await env.DB.prepare(`SELECT
      (SELECT count(*) FROM communications m WHERE length(trim(coalesce(m.ai_summary,'') || coalesce(m.message_transcript,'') || coalesce(m.subject,'')))>0 AND NOT EXISTS (SELECT 1 FROM claus_ai_embeddings e WHERE e.source_kind='communication' AND e.source_id=m.id AND e.provider=? AND e.model=?))+
      (SELECT count(*) FROM notes n WHERE length(trim(n.body))>0 AND NOT EXISTS (SELECT 1 FROM claus_ai_embeddings e WHERE e.source_kind='note' AND e.source_id=n.id AND e.provider=? AND e.model=?)) AS n`)
      .bind(config.provider, config.model, config.provider, config.model).first<{ n: number }>();
    return Response.json({ indexed: candidates.length, remaining: Number(remaining?.n || 0) });
  } catch (e) {
    console.error("Claus AI index error", { provider: config.provider, model: config.model, timestamp: new Date().toISOString(), error: e instanceof Error ? e.message : "Unknown" });
    return Response.json({ error: "Search indexing is temporarily unavailable." }, { status: 503 });
  }
}
