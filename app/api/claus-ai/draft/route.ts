import { env } from "cloudflare:workers";
import { authorizeCrmOwner } from "@/lib/crm-auth";
import { createInboundDraft } from "@/lib/claus-ai/auto-draft";
import { AiBudgetError } from "@/lib/claus-ai/budget";

export async function POST(request: Request) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  const data = await request.json().catch(() => ({})) as { communicationId?: number; regenerate?: boolean };
  if (!Number.isSafeInteger(data.communicationId) || Number(data.communicationId) <= 0) return Response.json({ error: "Choose a message first." }, { status: 400 });
  try {
    await createInboundDraft(env.DB, Number(data.communicationId), true, data.regenerate === true);
    const draft = await env.DB.prepare("SELECT id,contact_id,communication_id,medium,generated_draft,status FROM claus_ai_drafts WHERE communication_id=? ORDER BY id DESC LIMIT 1").bind(data.communicationId).first();
    return draft ? Response.json({ draft }) : Response.json({ error: "This message cannot be drafted." }, { status: 422 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "Unknown";
    console.error("Suggested response failed", {communicationId:data.communicationId,code:/^AI_[A-Z_]+$/.test(code)?code:error instanceof Error?error.name:"Unknown"});
    const message = code === "AI_NOT_CONFIGURED" ? "The reasoning AI connection needs setup in Settings."
      : code === "AI_EMPTY_RESPONSE" || code === "AI_INVALID_DRAFT" ? "The AI did not return a complete draft. Please try Suggest response again."
      : "Suggested response is temporarily unavailable. Please try again.";
    return Response.json({ error: error instanceof AiBudgetError ? error.code === "AI_DAILY_LIMIT" ? "AI usage limit reached for today." : error.code === "AI_MONTHLY_LIMIT" ? "AI monthly usage limit reached." : "This draft exceeds the per-request AI limit." : message }, { status: 503 });
  }
}
