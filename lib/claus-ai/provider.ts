import { env } from "cloudflare:workers";
import { executeTier, tierConfig, tierStatus } from "./provider-selection.mjs";
import { AiBudgetError, meteredRequest } from "./budget";

export type Tier = "fast" | "reasoning";
type Provider = { provider: string; model: string; key: string };
type TierConfiguration = Provider & { fallback: Provider | null };

const settings = () => env as unknown as Record<string, string | undefined>;
export function aiConfig() {
  const values = settings();
  return {
    fast: tierConfig(values, "fast") as TierConfiguration,
    reasoning: tierConfig(values, "reasoning") as TierConfiguration,
    embeddingProvider: values.EMBEDDING_PROVIDER || "",
    embeddingModel: values.EMBEDDING_MODEL || "",
  };
}

export function aiStatus() {
  const c = aiConfig();
  const fast = tierStatus(c.fast), reasoning = tierStatus(c.reasoning);
  return {
    fast, reasoning,
    provider: fast.provider, model: fast.model, reasoningModel: reasoning.model,
    embeddingProvider: c.embeddingProvider || "Not configured",
    embeddingModel: c.embeddingModel || "Not configured",
    status: fast.status !== "Not configured" && reasoning.status !== "Not configured" ? "Connected" :
      fast.status !== "Not configured" || reasoning.status !== "Not configured" ? "Partially configured" : "Not configured",
  };
}

class ProviderFailure extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function safeProviderMessage(body: unknown): { type: string; message: string } {
  if (!body || typeof body !== "object") return { type: "unknown", message: "Provider returned no structured error" };
  const error = (body as Record<string, any>).error;
  const type = typeof error?.type === "string" ? error.type.slice(0, 60).replace(/[^\w.-]/g, "") : "unknown";
  // Retain the provider's short diagnostic while removing credentials and possible echoed CRM content.
  const raw = typeof error?.message === "string" ? error.message : "";
  const diagnostic = raw.slice(0, 300)
    .replace(/(?:sk|ant-api)[\w-]{8,}/gi, "[redacted key]")
    .replace(/(?:Bearer|x-api-key|api[_ -]?key)\s*[:=]\s*\S+/gi, "[redacted credential]")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[redacted email]")
    .replace(/https?:\/\/\S+/gi, "[redacted URL]")
    .replace(/(["'`])[^"'`]{40,}\1/g, "[redacted quoted content]") || "Provider returned no error message";
  return { type, message: diagnostic };
}

async function jsonResponse(url: string, init: RequestInit, provider: Provider) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      let body: unknown;
      try { body = await response.json(); } catch { body = null; }
      const detail = safeProviderMessage(body);
      console.error("Claus AI provider request rejected", { provider: provider.provider, model: provider.model, status: response.status, errorType: detail.type, errorMessage: detail.message });
      throw new ProviderFailure(response.status, `Provider returned HTTP ${response.status}`);
    }
    return await response.json() as Record<string, any>;
  } finally { clearTimeout(timeout); }
}

async function request(provider: Provider, system: string, user: string, maxOutput: number) {
  const { model, key } = provider;
  const messages = [{ role: "system", content: system }, { role: "user", content: user }];
  let result: Record<string, any>;
  if (provider.provider === "openai" || provider.provider === "mistral") {
    result = await jsonResponse(provider.provider === "openai" ? "https://api.openai.com/v1/chat/completions" : "https://api.mistral.ai/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(provider.provider === "openai" ? { model, messages, max_completion_tokens: maxOutput } : { model, messages, temperature: 0.1, max_tokens: maxOutput }),
    }, provider);
    return { text: String(result.choices?.[0]?.message?.content || ""), usage: result.usage };
  }
  if (provider.provider === "anthropic") {
    result = await jsonResponse("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json", ...(settings().ANTHROPIC_WORKSPACE_ID ? { "anthropic-workspace-id": settings().ANTHROPIC_WORKSPACE_ID! } : {}) },
      body: JSON.stringify({ model, system, messages: [{ role: "user", content: user }], max_tokens: maxOutput }),
    }, provider);
    return { text: (result.content || []).filter((x: any) => x.type === "text").map((x: any) => x.text).join("\n"), usage: result.usage };
  }
  if (provider.provider === "google") {
    result = await jsonResponse(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: { temperature: 0.1, maxOutputTokens: maxOutput } }),
    }, provider);
    return { text: (result.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("\n"), usage: result.usageMetadata };
  }
  throw new Error("AI_NOT_CONFIGURED");
}

export async function complete(system: string, user: string, tier: Tier, metadata: { taskType?: "fast" | "reasoning" | "sms_draft" | "email_draft"; contactId?: number; sourceId?: string } = {}) {
  const config = aiConfig()[tier];
  const { result, selected, fallbackUsed } = await executeTier(config, async (provider: Provider) => {
    return meteredRequest({ provider: provider.provider, model: provider.model, tier, taskType: metadata.taskType || tier, system, prompt: user, contactId: metadata.contactId, sourceId: metadata.sourceId }, async maxOutput => {
      const result = await request(provider, system, user, maxOutput);
      if (!result.text.trim()) throw new ProviderFailure(503, "Provider returned no answer");
      const usage = result.usage || {};
      const actualUsd = Number(usage.cost_usd ?? usage.cost ?? NaN);
      return { value: result, usage: {
        input: Number(usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokenCount ?? 0),
        output: Number(usage.completion_tokens ?? usage.output_tokens ?? usage.candidatesTokenCount ?? 0),
        cached: Number(usage.prompt_tokens_details?.cached_tokens ?? usage.cache_read_input_tokens ?? usage.cachedContentTokenCount ?? 0),
        actualUsd: Number.isFinite(actualUsd) ? actualUsd : null,
      } };
    });
  }, (error: unknown) => !(error instanceof AiBudgetError) && (!(error instanceof ProviderFailure) || error.status === 408 || error.status === 429 || error.status >= 500));
  return { ...result, provider: selected.provider, model: selected.model, tier, fallbackUsed };
}
