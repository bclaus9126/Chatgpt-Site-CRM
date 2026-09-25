import { env } from "cloudflare:workers";
import { getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";

// One owner policy for every interactive CRM and Claus AI endpoint.
export function isCrmOwner(user: ChatGPTUser | null): user is ChatGPTUser {
  const owner = String((env as unknown as Record<string, string>).CRM_OWNER_EMAIL || "").trim().toLowerCase();
  return !!owner && !!user && user.email.trim().toLowerCase() === owner;
}

export async function authorizeCrmOwner(): Promise<
  | { user: ChatGPTUser; denied?: never }
  | { user?: never; denied: Response }
> {
  const user = await getChatGPTUser();
  if (isCrmOwner(user)) return { user };
  return {
    denied: Response.json(
      { error: user ? "This account is not authorized for Claus CRM." : "Sign in to access Claus CRM." },
      { status: user ? 403 : 401, headers: { "Cache-Control": "no-store" } },
    ),
  };
}
