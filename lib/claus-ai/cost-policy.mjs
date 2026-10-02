export const DEFAULT_LIMITS = Object.freeze({ monthlyTargetUsd: 25, monthlyWarningUsd: 50, monthlyHardLimitUsd: 75, dailyHardLimitUsd: 5, maxRequestCostUsd: 0.25, testMonthlyLimitUsd: 10 });
export const TOKEN_LIMITS = Object.freeze({
  fast: { input: 2600, output: 300 },
  reasoning: { input: 7800, output: 700 },
  sms_draft: { input: 3000, output: 240 },
  email_draft: { input: 6200, output: 550 },
  semantic_query: { input: 600, output: 0 },
  semantic_index: { input: 5500, output: 0 },
});

export const estimateTokens = text => Math.ceil(new TextEncoder().encode(text).length / 2);
export const estimatedCost = (input, output, inputRate, outputRate) => (input * inputRate + output * outputRate) / 1_000_000;
export function limitsFrom(values, overrides = {}) {
  const number = (key, fallback) => { const n = Number(overrides[key] ?? values[`AI_${key.replace(/[A-Z]/g, letter => `_${letter}`).toUpperCase()}`]); return Number.isFinite(n) && n > 0 ? n : fallback; };
  const limits = {
    monthlyTargetUsd: number("monthlyTargetUsd", DEFAULT_LIMITS.monthlyTargetUsd),
    monthlyWarningUsd: number("monthlyWarningUsd", DEFAULT_LIMITS.monthlyWarningUsd),
    monthlyHardLimitUsd: number("monthlyHardLimitUsd", DEFAULT_LIMITS.monthlyHardLimitUsd),
    dailyHardLimitUsd: number("dailyHardLimitUsd", DEFAULT_LIMITS.dailyHardLimitUsd),
    maxRequestCostUsd: number("maxRequestCostUsd", DEFAULT_LIMITS.maxRequestCostUsd),
    testMode: values.AI_TEST_MODE === "true",
    testMonthlyLimitUsd: number("testMonthlyLimitUsd", DEFAULT_LIMITS.testMonthlyLimitUsd),
    effectiveMonthlyHardUsd: 0,
  };
  limits.effectiveMonthlyHardUsd = limits.testMode ? Math.min(limits.monthlyHardLimitUsd, limits.testMonthlyLimitUsd) : limits.monthlyHardLimitUsd;
  return limits;
}

export function budgetBlock({ dailySpent, monthlySpent, reservation, limits }) {
  if (dailySpent + reservation > limits.dailyHardLimitUsd + 1e-9) return "AI_DAILY_LIMIT";
  if (monthlySpent + reservation > limits.effectiveMonthlyHardUsd + 1e-9) return "AI_MONTHLY_LIMIT";
  return null;
}

export function simpleMessage(text) {
  return /^(?:thanks?(?: you)?|thank you|ok(?:ay)?|sounds good|got it|cool|perfect|great|👍|👌|🙏)[.!\s👍👌🙏]*$/i.test(String(text || "").trim());
}
