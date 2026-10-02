import { test } from "node:test";
import assert from "node:assert/strict";
import { executeTier, isReady, needsReasoning, questionTier, tierConfig, tierForTask, tierStatus } from "../lib/claus-ai/provider-selection.mjs";

const values = {
  AI_FAST_PROVIDER: "anthropic", AI_FAST_MODEL: "fast-model", ANTHROPIC_API_KEY: "test-fast-key",
  AI_REASONING_PROVIDER: "openai", AI_REASONING_MODEL: "reasoning-model", OPENAI_API_KEY: "test-reasoning-key",
};

test("tiers use separate providers and only their own credentials", () => {
  const fast = tierConfig(values, "fast"), reasoning = tierConfig(values, "reasoning");
  assert.deepEqual([fast.provider, fast.model, fast.key], ["anthropic", "fast-model", "test-fast-key"]);
  assert.deepEqual([reasoning.provider, reasoning.model, reasoning.key], ["openai", "reasoning-model", "test-reasoning-key"]);
  assert.equal(tierStatus(fast).key, undefined);
  assert.equal(isReady(tierConfig({ ...values, OPENAI_API_KEY: "" }, "reasoning")), false);
  assert.equal(isReady(tierConfig({ ...values, OPENAI_API_KEY: "" }, "fast")), true);
});

test("fallback is unavailable until explicitly configured with a model and key", () => {
  assert.equal(tierConfig(values, "fast").fallback, null);
  const partial = tierConfig({ ...values, AI_FAST_FALLBACK_PROVIDER: "google" }, "fast");
  assert.equal(isReady(partial.fallback), false);
  const ready = tierConfig({ ...values, AI_FAST_FALLBACK_PROVIDER: "google", AI_FAST_FALLBACK_MODEL: "backup-model", GOOGLE_API_KEY: "test-backup-key", ANTHROPIC_API_KEY: "" }, "fast");
  assert.equal(tierStatus(ready).status, "Fallback only");
});

test("provider outages use only an explicit fallback", async () => {
  const primary = tierConfig(values, "fast");
  const calls = [];
  const unavailable = async provider => { calls.push(provider.provider); throw Error("Unavailable"); };
  await assert.rejects(executeTier(primary, unavailable, () => true), /Unavailable/);
  assert.deepEqual(calls, ["anthropic"]);
  const config = tierConfig({ ...values, AI_FAST_FALLBACK_PROVIDER: "openai", AI_FAST_FALLBACK_MODEL: "backup-model" }, "fast");
  calls.length = 0;
  const result = await executeTier(config, async provider => { calls.push(provider.provider); if (provider.provider === "anthropic") throw Error("Unavailable"); return "Backup answer"; }, () => true);
  assert.deepEqual(calls, ["anthropic", "openai"]);
  assert.deepEqual([result.result, result.selected.model, result.fallbackUsed], ["Backup answer", "backup-model", true]);
  calls.length = 0;
  await assert.rejects(executeTier(config, unavailable, () => false), /Unavailable/);
  assert.deepEqual(calls, ["anthropic"]);
});

test("tier-specific provider does not inherit another vendor's legacy model", () => {
  const config = tierConfig({ AI_PROVIDER: "openai", AI_MODEL: "old-openai-model", AI_FAST_PROVIDER: "anthropic" }, "fast");
  assert.equal(config.model, "");
});

test("fast questions escalate on low confidence, review flags and conflicts", () => {
  for (const task of ["tool_selection", "structured_extraction", "classification", "routine_summary", "simple_question", "routine_intelligence"]) assert.equal(tierForTask(task), "fast");
  for (const task of ["sms_draft", "email_draft", "conversation_reasoning", "ambiguity_resolution", "final_agreement", "conflicting_facts", "timeline_analysis", "multi_source_analysis"]) assert.equal(tierForTask(task), "reasoning");
  assert.equal(questionTier("Which past clients are sellers?"), "fast");
  assert.equal(questionTier("Draft a text reply"), "reasoning");
  assert.equal(questionTier("Which time did they finally agree to?"), "reasoning");
  assert.equal(questionTier("What did they discuss?", { multiSource: true, hasCommunication: true }), "reasoning");
  assert.equal(needsReasoning({ answer: "Recorded fact", confidence: 0.95, needs_review: false }), false);
  for (const result of [null, { answer: "Guess", confidence: 0.5 }, { answer: "A", confidence: 0.9, needs_review: true }, { answer: "A", confidence: 0.9, conflicting_values: true }]) assert.equal(needsReasoning(result), true);
});
