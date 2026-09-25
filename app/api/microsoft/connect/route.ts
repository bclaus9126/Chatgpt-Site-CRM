import { authorizeCrmOwner } from "@/lib/crm-auth";
import { env } from "cloudflare:workers";
import { authority, CALLBACK, challenge, config, configured, MAILBOX, random, SEND_SCOPE } from "@/lib/microsoft/graph";
export async function POST() {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied; const user = auth.user;
  if(!configured()) return Response.json({error:"Microsoft 365 application settings are needed before connecting."},{status:503});
  const state=random(),verifier=random(64);
  await env.DB.prepare("INSERT INTO microsoft_oauth_states (state,owner_user_id,verifier,expires_at) VALUES (?,?,?,?)").bind(state,user.userId,verifier,new Date(Date.now()+10*60000).toISOString()).run();
  const url=new URL(`${authority()}/authorize`);
  for(const [key,value] of Object.entries({client_id:config().MS_CLIENT_ID!,response_type:"code",redirect_uri:CALLBACK,response_mode:"query",scope:SEND_SCOPE,state,code_challenge:await challenge(verifier),code_challenge_method:"S256",login_hint:MAILBOX,prompt:"consent"})) url.searchParams.set(key,value);
  return Response.json({url:url.toString()},{headers:{"cache-control":"no-store","set-cookie":`claus_ms_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/api/microsoft`}});
}
