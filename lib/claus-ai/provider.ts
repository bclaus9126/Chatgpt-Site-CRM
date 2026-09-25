import { env } from "cloudflare:workers";

type Tier = "fast" | "reasoning";
type AiConfig = {
  provider: string;
  model: string;
  reasoningModel: string;
  embeddingProvider: string;
  embeddingModel: string;
  key: string;
};

export function aiConfig(): AiConfig {
  const values = env as unknown as Record<string, string | undefined>;
  const provider = (values.AI_PROVIDER || "").toLowerCase();
  const keyName: Record<string, string> = {
    openai: "OPENAI_API_KEY", anthropic: "ANTHROPIC_API_KEY",
    google: "GOOGLE_API_KEY", mistral: "MISTRAL_API_KEY",
  };
  return {
    provider, model: values.AI_MODEL || "",
    reasoningModel: values.AI_REASONING_MODEL || values.AI_MODEL || "",
    embeddingProvider: values.EMBEDDING_PROVIDER || "",
    embeddingModel: values.EMBEDDING_MODEL || "",
    key: values[keyName[provider] || ""] || "",
  };
}

export function aiStatus() {
  const { provider, model, reasoningModel, embeddingProvider, embeddingModel, key } = aiConfig();
  return {
    provider: provider || "Not configured", model: model || "Not configured",
    reasoningModel: reasoningModel || "Not configured",
    embeddingProvider: embeddingProvider || "Not configured",
    embeddingModel: embeddingModel || "Not configured",
    status: provider && model && key ? "Connected" : "Not configured",
  };
}

async function jsonResponse(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
    return await response.json() as Record<string, any>;
  } finally { clearTimeout(timeout); }
}

export async function complete(system: string, user: string, tier: Tier) {
  const c = aiConfig();
  const model = tier === "reasoning" ? c.reasoningModel : c.model;
  if (!c.provider || !c.key || !model) throw new Error("AI_NOT_CONFIGURED");
  const messages = [{ role: "system", content: system }, { role: "user", content: user }];
  let result: Record<string, any>;
  if (c.provider === "openai" || c.provider === "mistral") {
    result = await jsonResponse(c.provider === "openai" ? "https://api.openai.com/v1/chat/completions" : "https://api.mistral.ai/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${c.key}`, "Content-Type": "application/json" },
      body: JSON.stringify(c.provider === "openai" ? { model, messages, max_completion_tokens: 900 } : { model, messages, temperature: 0.1, max_tokens: 900 }),
    });
    return { text: String(result.choices?.[0]?.message?.content || ""), model, usage: result.usage };
  }
  if (c.provider === "anthropic") {
    result = await jsonResponse("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "x-api-key": c.key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model, system, messages: [{ role: "user", content: user }], max_tokens: 900 }),
    });
    return { text: (result.content || []).filter((x: any) => x.type === "text").map((x: any) => x.text).join("\n"), model, usage: result.usage };
  }
  if (c.provider === "google") {
    result = await jsonResponse(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", headers: { "x-goog-api-key": c.key, "Content-Type": "application/json" },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 900 } }),
    });
    return { text: (result.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("\n"), model, usage: result.usageMetadata };
  }
  throw new Error("AI_NOT_CONFIGURED");
}
