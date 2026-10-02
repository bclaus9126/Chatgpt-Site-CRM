import { env } from 'cloudflare:workers';
import { stopContact, verifyShortUnsubscribe } from '@/lib/campaign';

export const dynamic='force-dynamic';
type Context={params:Promise<{token:string}>};
const headers={'content-type':'text/html;charset=utf-8','cache-control':'no-store'};
export async function GET(_request:Request,{params}:Context) {
  const id=await verifyShortUnsubscribe((await params).token);
  return new Response(id?'<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Unsubscribe</title></head><body style="font:18px system-ui;max-width:36rem;margin:3rem auto;padding:1rem"><h1>Stop follow-up emails?</h1><p>You can unsubscribe from Claus CRM campaign emails.</p><form method="post"><button style="font:inherit;padding:12px 18px">Unsubscribe</button></form></body></html>':'This unsubscribe link is invalid.',{status:id?200:404,headers});
}
export async function POST(_request:Request,{params}:Context) {
  const id=await verifyShortUnsubscribe((await params).token);
  if(!id)return new Response('Invalid link',{status:404,headers:{'cache-control':'no-store'}});
  await env.DB.prepare('UPDATE contacts SET email_unsubscribed=1 WHERE id=?').bind(id).run();
  await stopContact(id,'Email unsubscribe');
  return new Response('You have been unsubscribed from Claus CRM follow-up emails.',{headers:{'content-type':'text/plain;charset=utf-8','cache-control':'no-store'}});
}
