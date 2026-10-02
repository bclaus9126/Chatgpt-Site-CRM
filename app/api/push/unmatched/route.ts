import { env } from "cloudflare:workers";
import { authorizeCrmOwner } from "@/lib/crm-auth";
export async function GET(request: Request) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id < 1) return Response.json({error:"Invalid ID"},{status:400});
  const row = await env.DB.prepare("SELECT id,occurred_at,from_number,to_number,message_transcript,participants FROM communications WHERE id=? AND contact_id IS NULL AND source_system='telnyx' AND type='SMS' AND direction='inbound'").bind(id).first();
  return row ? Response.json(row) : Response.json({error:"Message unavailable"},{status:404});
}
