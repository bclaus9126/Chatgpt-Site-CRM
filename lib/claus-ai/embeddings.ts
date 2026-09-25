import { env } from "cloudflare:workers";

export function embeddingConfig() {
  const values = env as unknown as Record<string, string | undefined>;
  const provider = (values.EMBEDDING_PROVIDER || "").toLowerCase();
  const model = values.EMBEDDING_MODEL || "";
  const key = values[({ openai: "OPENAI_API_KEY", google: "GOOGLE_API_KEY", mistral: "MISTRAL_API_KEY" } as Record<string, string>)[provider]] || "";
  return { provider, model, key, ready: !!provider && !!model && !!key };
}

export async function embed(texts: string[]): Promise<number[][]> {
  const { provider, model, key, ready } = embeddingConfig();
  if (!ready) throw new Error("EMBEDDINGS_NOT_CONFIGURED");
  if (!texts.length || texts.length > 25) throw new Error("Invalid embedding batch");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    let url: string, body: unknown, headers: Record<string, string> = { "Content-Type": "application/json" };
    if (provider === "openai" || provider === "mistral") {
      url = provider === "openai" ? "https://api.openai.com/v1/embeddings" : "https://api.mistral.ai/v1/embeddings";
      headers.Authorization = `Bearer ${key}`;
      body = { model, input: texts };
    } else if (provider === "google") {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:batchEmbedContents`;
      headers["x-goog-api-key"] = key;
      body = { requests: texts.map(text => ({ model: `models/${model}`, content: { parts: [{ text }] } })) };
    } else throw new Error("EMBEDDINGS_NOT_CONFIGURED");
    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
    if (!response.ok) throw new Error(`Embedding provider returned HTTP ${response.status}`);
    const data = await response.json() as Record<string, any>;
    const vectors: number[][] = provider === "google" ? (data.embeddings || []).map((r: any) => r.values) : (data.data || []).sort((a: any, b: any) => a.index - b.index).map((r: any) => r.embedding);
    if (vectors.length !== texts.length || vectors.some(v => !Array.isArray(v) || !v.length || v.some(x => !Number.isFinite(x)))) throw new Error("Invalid embedding response");
    return vectors;
  } finally { clearTimeout(timeout); }
}

export function cosine(a: number[], b: number[]) {
  if (a.length !== b.length) return -1;
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2; }
  return dot / (Math.sqrt(aa) * Math.sqrt(bb) || 1);
}
