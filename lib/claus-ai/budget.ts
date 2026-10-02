import { env } from "cloudflare:workers";
import { budgetBlock, estimatedCost, estimateTokens, limitsFrom, TOKEN_LIMITS } from "./cost-policy.mjs";

type Task = keyof typeof TOKEN_LIMITS;
type Limits = ReturnType<typeof limitsFrom>;
type Usage = { input: number; output: number; cached: number; actualUsd?: number | null };
const values = () => env as unknown as Record<string, string | undefined>;
const day = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const money = (value: unknown) => Math.round(Number(value || 0) * 100000000) / 100000000;
const positive = (value: unknown, fallback: number) => { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : fallback; };

export async function aiLimits(): Promise<Limits & { autoGenerateMessageDrafts: boolean }> {
  const row = await env.DB.prepare("SELECT * FROM ai_settings WHERE id=1").first<Record<string, number | null>>();
  const v = values();
  const limits = limitsFrom(v, row ? {
    monthlyTargetUsd: row.monthly_target_usd, monthlyWarningUsd: row.monthly_warning_usd,
    monthlyHardLimitUsd: row.monthly_hard_limit_usd, dailyHardLimitUsd: row.daily_hard_limit_usd,
    maxRequestCostUsd: row.max_request_cost_usd,
  } : {});
  return { ...limits, autoGenerateMessageDrafts: row?.auto_generate_message_drafts === 1 || (!row && v.AUTO_GENERATE_MESSAGE_DRAFTS === "true") };
}

export function rateFor(tier: string) {
  const v = values();
  const prefix = tier === "embedding" ? "AI_EMBEDDING" : tier === "reasoning" ? "AI_REASONING" : "AI_FAST";
  return { input: positive(v[`${prefix}_INPUT_USD_PER_MILLION`], 30), output: tier === "embedding" ? 0 : positive(v[`${prefix}_OUTPUT_USD_PER_MILLION`], 120) };
}

export class AiBudgetError extends Error {
  constructor(readonly code: string) { super(code); }
}

export async function aiUsageSummary() {
  const currentDay = day(), month = currentDay.slice(0, 7), limits = await aiLimits();
  const rows = (await env.DB.prepare("SELECT tier,task_type,count(*) requests,sum(CASE WHEN status='reserved' THEN reserved_usd ELSE estimated_usd END) cost FROM ai_usage WHERE billing_month=? AND status<>'blocked' GROUP BY tier,task_type").bind(month).all<{tier:string;task_type:string;requests:number;cost:number}>()).results;
  const daily = await env.DB.prepare("SELECT coalesce(sum(CASE WHEN status='reserved' THEN reserved_usd ELSE estimated_usd END),0) amount FROM ai_usage WHERE billing_day=? AND status<>'blocked'").bind(currentDay).first<{amount:number}>();
  const spent = money(rows.reduce((sum, r) => sum + Number(r.cost || 0), 0));
  const fast = money(rows.filter(r => r.tier === "fast").reduce((sum, r) => sum + Number(r.cost || 0), 0));
  const reasoning = money(rows.filter(r => r.tier === "reasoning").reduce((sum, r) => sum + Number(r.cost || 0), 0));
  const embedding = money(rows.filter(r => r.tier === "embedding").reduce((sum, r) => sum + Number(r.cost || 0), 0));
  const requests = rows.reduce((sum, r) => sum + Number(r.requests), 0);
  const date = Number(currentDay.slice(8, 10)), days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const projected = money(spent / Math.max(date, 1) * days);
  return { month, spent, dailySpent: money(daily?.amount), fast, reasoning, embedding, requests, averageCost: requests ? money(spent / requests) : 0, projected, byTask: rows.map(r => ({ task: r.task_type, tier: r.tier, requests: Number(r.requests), spent: money(r.cost) })), limits, warning: spent >= limits.monthlyWarningUsd || projected >= limits.monthlyWarningUsd, targetExceeded: spent >= limits.monthlyTargetUsd || projected >= limits.monthlyTargetUsd, blocked: budgetBlock({ dailySpent: Number(daily?.amount || 0), monthlySpent: spent, reservation: limits.maxRequestCostUsd, limits }) };
}

export async function meteredRequest<T>(input: { provider: string; model: string; tier: "fast" | "reasoning" | "embedding"; taskType: Task; system?: string; prompt: string; contactId?: number; sourceId?: string }, invoke: (maxOutput: number) => Promise<{ value: T; usage: Usage }>): Promise<T> {
  const caps = TOKEN_LIMITS[input.taskType];
  const inputTokens = estimateTokens((input.system || "") + input.prompt);
  if (inputTokens > caps.input) throw new AiBudgetError("AI_REQUEST_TOO_LARGE");
  const limits = await aiLimits(), rate = rateFor(input.tier);
  const expected = estimatedCost(inputTokens, caps.output, rate.input, rate.output);
  if (expected > limits.maxRequestCostUsd) throw new AiBudgetError("AI_REQUEST_TOO_EXPENSIVE");
  const reserve = limits.maxRequestCostUsd, id = crypto.randomUUID(), currentDay = day(), month = currentDay.slice(0, 7);
  const inserted = await env.DB.prepare(`INSERT INTO ai_usage (id,created_at,billing_day,billing_month,provider,model,tier,task_type,contact_id,source_id,input_tokens,output_tokens,cached_tokens,reserved_usd,estimated_usd,status)
    SELECT ?,?,?,?,?,?,?,?,?,?,?,0,0,?,?,'reserved' WHERE
    (SELECT coalesce(sum(CASE WHEN status='reserved' THEN reserved_usd ELSE estimated_usd END),0) FROM ai_usage WHERE billing_day=? AND status<>'blocked')+? <= ? AND
    (SELECT coalesce(sum(CASE WHEN status='reserved' THEN reserved_usd ELSE estimated_usd END),0) FROM ai_usage WHERE billing_month=? AND status<>'blocked')+? <= ?`)
    .bind(id,new Date().toISOString(),currentDay,month,input.provider,input.model,input.tier,input.taskType,input.contactId||null,input.sourceId||null,inputTokens,reserve,expected,currentDay,reserve,limits.dailyHardLimitUsd,month,reserve,limits.effectiveMonthlyHardUsd).run();
  if (!inserted.meta.changes) {
    const summary = await aiUsageSummary();
    const code = budgetBlock({ dailySpent: summary.dailySpent, monthlySpent: summary.spent, reservation: reserve, limits }) || "AI_MONTHLY_LIMIT";
    await env.DB.prepare("INSERT INTO ai_usage (id,created_at,billing_day,billing_month,provider,model,tier,task_type,contact_id,source_id,reserved_usd,estimated_usd,status,error_code) VALUES (?,?,?,?,?,?,?,?,?,?,0,0,'blocked',?)").bind(id,new Date().toISOString(),currentDay,month,input.provider,input.model,input.tier,input.taskType,input.contactId||null,input.sourceId||null,code).run();
    throw new AiBudgetError(code);
  }
  try {
    const response = await invoke(caps.output);
    const used = response.usage;
    const amount = money(used.actualUsd ?? estimatedCost(used.input || inputTokens, used.output || 0, rate.input, rate.output));
    await env.DB.prepare("UPDATE ai_usage SET status='success',input_tokens=?,output_tokens=?,cached_tokens=?,estimated_usd=?,actual_usd=? WHERE id=?").bind(used.input||inputTokens,used.output||0,used.cached||0,amount,used.actualUsd ?? null,id).run();
    return response.value;
  } catch (error) {
    await env.DB.prepare("UPDATE ai_usage SET status='failed',estimated_usd=reserved_usd,error_code=? WHERE id=?").bind(error instanceof Error ? error.name.slice(0,50) : "ProviderFailure",id).run();
    throw error;
  }
}
