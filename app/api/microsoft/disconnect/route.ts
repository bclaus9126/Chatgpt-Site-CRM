import { authorizeCrmOwner } from "@/lib/crm-auth";
import { env } from "cloudflare:workers";
import { accessToken, connection, graph } from "@/lib/microsoft/graph";
export async function POST() {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied; const user = auth.user;
  const row=await connection(); if(!row || row.owner_user_id!==user.userId) return Response.json({error:"Mailbox not connected to this account"},{status:403});
  if(row.subscription_id) { try {await graph(await accessToken(row),`/subscriptions/${encodeURIComponent(row.subscription_id)}`,{method:"DELETE"})} catch { /* Local disconnect still revokes the CRM's stored access. */ } }
  await env.DB.prepare("DELETE FROM microsoft_mail_connections WHERE id=?").bind(row.id).run();
  return Response.json({ok:true});
}
