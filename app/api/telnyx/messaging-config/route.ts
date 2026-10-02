import { env } from "cloudflare:workers";
import { authorizeCrmOwner } from "@/lib/crm-auth";
import { BUSINESS_NUMBER } from "@/lib/telnyx-call-control";

const webhook = "https://claus-crm.bclaus.chatgpt.site/api/telnyx/sms";
type Data = Record<string, any>;
async function telnyx(path: string, options?: RequestInit): Promise<Data> {
  const key = (env as unknown as { TELNYX_API_KEY?: string }).TELNYX_API_KEY;
  if (!key) throw Error("Telnyx API key is not configured");
  const response = await fetch(`https://api.telnyx.com/v2/${path}`, {
    ...options, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  });
  const result = await response.json().catch(() => ({})) as Data;
  if (!response.ok) throw Error(`Telnyx HTTP ${response.status}: ${String(result.errors?.[0]?.code || "unknown")}`);
  return result;
}
async function status() {
  const listing = await telnyx(`phone_numbers/messaging?filter%5Bphone_number%5D=${encodeURIComponent(BUSINESS_NUMBER)}`);
  const number = (listing.data || []).find((item: Data) => item.phone_number === BUSINESS_NUMBER);
  const assigned = number?.messaging_profile_id || null;
  const profile = assigned ? (await telnyx(`messaging_profiles/${encodeURIComponent(assigned)}`)).data : null;
  const profiles = await telnyx("messaging_profiles?page%5Bsize%5D=100");
  const campaign = await telnyx(`10dlc/phone_number_campaigns/${encodeURIComponent(BUSINESS_NUMBER)}`).catch(() => null);
  return {
    businessNumber: BUSINESS_NUMBER, profileId: assigned, profileName: profile?.name || null,
    webhookUrl: profile?.webhook_url || null, expectedWebhookUrl: webhook,
    campaignId: campaign?.campaignId || null, campaignAssignment: campaign?.assignmentStatus || null,
    messagingProduct: number?.messaging_product || null,
    numberFound: Boolean(number), availableProfiles: (profiles.data || []).map((item: Data) => ({id:item.id,name:item.name,webhookUrl:item.webhook_url,enabled:item.enabled})),
    enabled: (await env.DB.prepare("SELECT payload FROM telnyx_events WHERE event_id='call-notice-settings'").first<{payload:string}>())?.payload,
    callNoticesAvailable: (env as unknown as {INBOUND_CALL_CONTEXT_SMS_ENABLED?:string}).INBOUND_CALL_CONTEXT_SMS_ENABLED === "true",
  };
}
export async function GET() {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  try { return Response.json(await status()); }
  catch (error) { return Response.json({error: error instanceof Error ? error.message : "Telnyx status unavailable"},{status:502}); }
}
export async function POST(request: Request) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  const body = await request.json().catch(() => ({})) as {action?: string; enabled?:boolean};
  if (body.action === "call-notices" && typeof body.enabled === "boolean") {
    await env.DB.prepare("INSERT INTO telnyx_events (event_id,event_type,payload) VALUES ('call-notice-settings','settings',?) ON CONFLICT(event_id) DO UPDATE SET payload=excluded.payload")
      .bind(JSON.stringify({enabled:body.enabled})).run();
    return Response.json({ok:true});
  }
  if (body.action !== "connect-webhook" && body.action !== "assign-profile") return Response.json({error:"Invalid action"},{status:400});
  try {
    const current = await status();
    // Telnyx may omit campaign assignment from this lookup even after approval.
    // Reject a reported non-assigned state; let Telnyx validate assignments
    // when the lookup has no assignment data.
    if (current.campaignAssignment && current.campaignAssignment !== "ASSIGNED") return Response.json({error:"The business number has no confirmed assigned 10DLC campaign. No Telnyx setting changed."},{status:409});
    if (body.action === "assign-profile") {
      if (!current.numberFound || current.profileId || current.availableProfiles.length !== 1 || !current.availableProfiles[0].enabled) return Response.json({error:"A single enabled profile and an unassigned business number are required."},{status:409});
      await telnyx(`phone_numbers/${encodeURIComponent(BUSINESS_NUMBER)}/messaging`,{method:"PATCH",body:JSON.stringify({messaging_profile_id:current.availableProfiles[0].id})});
      return Response.json({ok:true,...await status()});
    }
    if (!current.profileId) return Response.json({error:"Assign the business number to a messaging profile first."},{status:409});
    await telnyx(`messaging_profiles/${encodeURIComponent(current.profileId)}`,{method:"PATCH",body:JSON.stringify({webhook_url:webhook,webhook_api_version:"2"})});
    return Response.json({ok:true,...await status()});
  } catch (error) { return Response.json({error:error instanceof Error ? error.message : "Telnyx update failed"},{status:502}); }
}
