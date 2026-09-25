import { authorizeCrmOwner } from "@/lib/crm-auth";
import { env, waitUntil } from "cloudflare:workers";
import {
  BRAD_CELL,
  BUSINESS_NUMBER,
  VOICE_CONNECTION_ID,
  dialCall,
  normalizePhone,
} from "@/lib/telnyx-call-control";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  const body = (await request.json().catch(() => ({}))) as {
    contactId?: number;
  };
  if (!Number.isInteger(body.contactId))
    return Response.json({ error: "Choose a contact first" }, { status: 400 });
  const contact = await env.DB.prepare(
    "SELECT id,first_name,last_name,phone FROM contacts WHERE id=?",
  )
    .bind(body.contactId)
    .first<{
      id: number;
      first_name: string;
      last_name: string;
      phone: string | null;
    }>();
  const contactNumber = normalizePhone(contact?.phone);
  if (!contact || !contactNumber)
    return Response.json(
      { error: "This contact does not have a valid phone number" },
      { status: 400 },
    );

  const flowId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const communication = await env.DB.prepare(
    `INSERT INTO communications
    (contact_id,type,direction,occurred_at,external_provider_id,from_number,to_number,caller_number,destination_number,
     brad_cell_number,business_number,started_at,status,subject,related_call_leg_ids)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`,
  )
    .bind(
      contact.id,
      "Call",
      "outgoing",
      startedAt,
      flowId,
      BUSINESS_NUMBER,
      contactNumber,
      BUSINESS_NUMBER,
      contactNumber,
      BRAD_CELL,
      BUSINESS_NUMBER,
      startedAt,
      "Calling Brad",
      `Call with ${contact.first_name} ${contact.last_name}`,
      "[]",
    )
    .first<{ id: number }>();
  if (!communication)
    return Response.json(
      { error: "Could not create the call record" },
      { status: 500 },
    );
  await env.DB.prepare(
    `INSERT INTO telnyx_call_flows
    (id,communication_id,direction,contact_id,contact_number,connection_id,status) VALUES (?,?,?,?,?,?,?)`,
  )
    .bind(
      flowId,
      communication.id,
      "outgoing",
      contact.id,
      contactNumber,
      VOICE_CONNECTION_ID,
      "Calling Brad",
    )
    .run();

  const webhookUrl = `${new URL(request.url).origin}/api/telnyx/voice`;
  try {
    const leg = await dialCall({
      to: BRAD_CELL,
      connectionId: VOICE_CONNECTION_ID,
      webhookUrl,
      clientState: { flowId, role: "brad" },
      commandId: `${flowId}:brad`,
    });
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE telnyx_call_flows SET brad_call_control_id=?,call_session_id=COALESCE(?,call_session_id),updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      ).bind(leg.call_control_id, leg.call_session_id ?? null, flowId),
      env.DB.prepare(
        `UPDATE communications SET call_control_id=?,call_leg_id=?,related_call_leg_ids=? WHERE id=?`,
      ).bind(
        leg.call_control_id,
        leg.call_leg_id ?? null,
        JSON.stringify(leg.call_leg_id ? [leg.call_leg_id] : []),
        communication.id,
      ),
    ]);
    return Response.json({
      ok: true,
      flowId,
      communicationId: communication.id,
      status: "Calling Brad",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not start the call";
    waitUntil(
      env.DB.batch([
        env.DB.prepare(
          "UPDATE telnyx_call_flows SET status='Failed',updated_at=CURRENT_TIMESTAMP WHERE id=?",
        ).bind(flowId),
        env.DB.prepare(
          "UPDATE communications SET status='Failed',ended_at=CURRENT_TIMESTAMP WHERE id=?",
        ).bind(communication.id),
      ]),
    );
    return Response.json({ error: message }, { status: 502 });
  }
}
