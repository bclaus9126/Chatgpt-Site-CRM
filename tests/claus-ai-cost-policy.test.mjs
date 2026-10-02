import { test } from "node:test";
import assert from "node:assert/strict";
import { budgetBlock, estimatedCost, estimateTokens, limitsFrom, simpleMessage, TOKEN_LIMITS } from "../lib/claus-ai/cost-policy.mjs";

test("monthly, daily and test limits are explicit", () => {
  const defaults = limitsFrom({});
  assert.deepEqual([defaults.monthlyTargetUsd, defaults.monthlyWarningUsd, defaults.monthlyHardLimitUsd, defaults.dailyHardLimitUsd, defaults.maxRequestCostUsd], [25, 50, 75, 5, 0.25]);
  assert.equal(budgetBlock({ dailySpent: 4.9, monthlySpent: 3, reservation: 0.25, limits: defaults }), "AI_DAILY_LIMIT");
  assert.equal(budgetBlock({ dailySpent: 0, monthlySpent: 74.9, reservation: 0.25, limits: defaults }), "AI_MONTHLY_LIMIT");
  const testLimits = limitsFrom({ AI_TEST_MODE: "true", AI_TEST_MONTHLY_LIMIT_USD: "10" }, { monthlyHardLimitUsd: 100 });
  assert.equal(testLimits.effectiveMonthlyHardUsd, 10);
  assert.equal(budgetBlock({ dailySpent: 0, monthlySpent: 9.9, reservation: 0.25, limits: testLimits }), "AI_MONTHLY_LIMIT");
});

test("per-request estimate and token caps stay bounded", () => {
  assert.ok(estimateTokens("A".repeat(6000)) > TOKEN_LIMITS.fast.input);
  assert.ok(TOKEN_LIMITS.sms_draft.output < TOKEN_LIMITS.email_draft.output);
  assert.ok(estimatedCost(1000, 300, 30, 120) > 0);
});

test("acknowledgments do not trigger automatic drafting", () => {
  for (const text of ["Thanks", "Ok.", "Sounds good!", "👍"]) assert.equal(simpleMessage(text), true);
  assert.equal(simpleMessage("Thanks, can we meet Thursday?"), false);
});
