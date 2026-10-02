export const PROVIDER_KEYS = Object.freeze({
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_API_KEY",
  mistral: "MISTRAL_API_KEY",
});

const clean = value => String(value || "").trim();

export function tierConfig(values, tier) {
  const prefix = tier === "reasoning" ? "AI_REASONING" : "AI_FAST";
  const legacyProvider = clean(values.AI_PROVIDER).toLowerCase();
  const selectedProvider = clean(values[`${prefix}_PROVIDER`]).toLowerCase();
  const provider = selectedProvider || legacyProvider;
  const model = clean(values[`${prefix}_MODEL`] || (!selectedProvider ? (tier === "reasoning" ? values.AI_REASONING_MODEL || values.AI_MODEL : values.AI_MODEL) : ""));
  const fallbackProvider = clean(values[`${prefix}_FALLBACK_PROVIDER`]).toLowerCase();
  const fallbackModel = clean(values[`${prefix}_FALLBACK_MODEL`]);
  return {
    provider, model, key: clean(values[PROVIDER_KEYS[provider]]),
    fallback: fallbackProvider || fallbackModel ? {
      provider: fallbackProvider, model: fallbackModel,
      key: clean(values[PROVIDER_KEYS[fallbackProvider]]),
    } : null,
  };
}

export function isReady(config) {
  return !!PROVIDER_KEYS[config.provider] && !!config.model && !!config.key;
}

export function tierStatus(config) {
  return {
    provider: config.provider || "Not configured",
    model: config.model || "Not configured",
    fallbackProvider: config.fallback?.provider || "Not configured",
    fallbackModel: config.fallback?.model || "Not configured",
    status: isReady(config) ? "Connected" : isReady(config.fallback || {}) ? "Fallback only" : "Not configured",
  };
}

export async function executeTier(config, invoke, canRetry) {
  const fallback = config.fallback;
  if (!isReady(config) && !isReady(fallback || {})) throw new Error("AI_NOT_CONFIGURED");
  const primary = isReady(config) ? config : fallback;
  try {
    return { result: await invoke(primary), selected: primary, fallbackUsed: primary === fallback };
  } catch (error) {
    if (!fallback || primary === fallback || !isReady(fallback) || !canRetry(error)) throw error;
    return { result: await invoke(fallback), selected: fallback, fallbackUsed: true };
  }
}

export function needsReasoning(result) {
  if (!result || typeof result.answer !== "string" || !result.answer.trim()) return true;
  const confidence = Number(result.confidence);
  return result.needs_review === true || result.conflicting_values === true ||
    !Number.isFinite(confidence) || confidence < 0.7;
}

export function questionTier(question, context = {}) {
  if (/\b(?:draft|reply|respond|write|suggest).{0,40}\b(?:sms|text|email|message|response|reply)\b|\b(?:sms|text|email|message).{0,40}\b(?:draft|reply|respond|write|suggest)\b/i.test(question)) return "reasoning";
  if (/\b(?:conflict\w*|contradic\w*|changed?|reschedul\w*|moved|updated|revised|countered|settled|confirmed|earlier|later|previous|timeline|why|compare|difference|final|agreed|accepted|latest|actually|which time|which date|which price)\b/i.test(question)) return "reasoning";
  // A question that joins communication and another source needs chronology and context.
  if (context.multiSource && context.hasCommunication) return "reasoning";
  return "fast";
}

const REASONING_TASKS = new Set(["sms_draft", "email_draft", "conversation_reasoning", "ambiguity_resolution", "final_agreement", "conflicting_facts", "timeline_analysis", "multi_source_analysis"]);
const FAST_TASKS = new Set(["tool_selection", "structured_extraction", "classification", "routine_summary", "simple_question", "routine_intelligence"]);
export function tierForTask(task) {
  if (REASONING_TASKS.has(task)) return "reasoning";
  if (FAST_TASKS.has(task)) return "fast";
  throw new Error("UNKNOWN_AI_TASK");
}
