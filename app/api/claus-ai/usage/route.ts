import { env } from "cloudflare:workers";
import { authorizeCrmOwner } from "@/lib/crm-auth";
import { aiUsageSummary } from "@/lib/claus-ai/budget";

export async function GET() {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  return Response.json(await aiUsageSummary(), { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const keys = ["monthlyTargetUsd", "monthlyWarningUsd", "monthlyHardLimitUsd", "dailyHardLimitUsd", "maxRequestCostUsd"] as const;
  const parsed = keys.map(key => Number(body[key]));
  if (parsed.some(n => !Number.isFinite(n) || n <= 0 || n > 10000) || parsed[0] > parsed[1] || parsed[1] > parsed[2] || parsed[4] > parsed[3] || typeof body.autoGenerateMessageDrafts !== "boolean") return Response.json({ error: "Enter valid limits. Target must be at or below warning, warning at or below hard limit, and per-request at or below daily limit." }, { status: 400 });
  await env.DB.prepare(`INSERT INTO ai_settings (id,monthly_target_usd,monthly_warning_usd,monthly_hard_limit_usd,daily_hard_limit_usd,max_request_cost_usd,auto_generate_message_drafts,updated_at)
    VALUES (1,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET monthly_target_usd=excluded.monthly_target_usd,monthly_warning_usd=excluded.monthly_warning_usd,monthly_hard_limit_usd=excluded.monthly_hard_limit_usd,daily_hard_limit_usd=excluded.daily_hard_limit_usd,max_request_cost_usd=excluded.max_request_cost_usd,auto_generate_message_drafts=excluded.auto_generate_message_drafts,updated_at=CURRENT_TIMESTAMP`)
    .bind(...parsed, body.autoGenerateMessageDrafts ? 1 : 0).run();
  return Response.json(await aiUsageSummary(), { headers: { "Cache-Control": "no-store" } });
}
