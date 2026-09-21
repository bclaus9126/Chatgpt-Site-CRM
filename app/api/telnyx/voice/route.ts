import { env, waitUntil } from "cloudflare:workers";
import {
  BRAD_CELL,
  BUSINESS_NUMBER,
  decodeClientState,
  dialCall,
  normalizePhone,
} from "@/lib/telnyx-call-control";

export const dynamic = "force-dynamic";
type TelnyxEvent = {
  data?: {
    id?: string;
    event_type?: string;
    occurred_at?: string;
    payload?: Record<string, unknown>;
  };
};
type Flow = {
  id: string;
  communication_id: number;
  direction: string;
  contact_id: number | null;
  contact_number: string | null;
  call_session_id: string | null;
  primary_call_control_id: string | null;
  brad_call_control_id: string | null;
  contact_call_control_id: string | null;
  connection_id: string;
  status: string;
};
const supportedEvents = new Set([
  "call.initiated",
  "call.answered",
  "call.hangup",
  "call.bridged",
  "call.recording.saved",
]);

function decodeBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
function decodeHex(value: string) {
  const normalized = value.trim().replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/i.test(normalized))
    throw new Error("Invalid Telnyx public key");
  return Uint8Array.from(normalized.match(/.{2}/g)!, (b) =>
    Number.parseInt(b, 16),
  );
}
function decodePublicKey(value: string) {
  const trimmed = value.trim();
  const decoded = /^[0-9a-f]{64}$/i.test(trimmed)
    ? decodeHex(trimmed)
    : decodeBase64(trimmed);
  if (decoded.byteLength !== 32)
    throw new Error("Invalid Telnyx public key length");
  return decoded;
}
async function verifyTelnyxSignature(request: Request, rawBody: string) {
  const publicKey = (env as unknown as { TELNYX_PUBLIC_KEY?: string })
    .TELNYX_PUBLIC_KEY;
  if (!publicKey) {
    console.error("TELNYX_PUBLIC_KEY is not configured; rejecting webhook");
    return false;
  }
  const signature = request.headers.get("telnyx-signature-ed25519"),
    timestamp = request.headers.get("telnyx-timestamp");
  if (!signature || !timestamp) return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300)
    return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      decodePublicKey(publicKey),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return crypto.subtle.verify(
      "Ed25519",
      key,
      decodeBase64(signature),
      new TextEncoder().encode(`${timestamp}|${rawBody}`),
    );
  } catch (error) {
    console.error("Telnyx signature verification failed", error);
    return false;
  }
}
async function saveVoiceEvent(event: TelnyxEvent) {
  const data = event.data ?? {},
    p = data.payload ?? {};
  const result = await env.DB.prepare(
    `INSERT INTO telnyx_events
  (event_id,event_type,call_control_id,call_leg_id,call_session_id,from_number,to_number,direction,payload) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(event_id) DO NOTHING`,
  )
    .bind(
      data.id ?? crypto.randomUUID(),
      data.event_type ?? "unknown",
      p.call_control_id ?? null,
      p.call_leg_id ?? null,
      p.call_session_id ?? null,
      p.from ?? p.from_number ?? null,
      p.to ?? p.to_number ?? null,
      p.direction ?? null,
      JSON.stringify(event),
    )
    .run();
  return (result.meta.changes ?? 0) > 0;
}
async function saveControlEvent(
  event: TelnyxEvent,
  type: string,
  detail: Record<string, unknown>,
) {
  const data = event.data ?? {},
    p = data.payload ?? {};
  await env.DB.prepare(
    `INSERT INTO telnyx_events
  (event_id,event_type,call_control_id,call_leg_id,call_session_id,from_number,to_number,direction,payload) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(event_id) DO UPDATE SET payload=excluded.payload`,
  )
    .bind(
      `${data.id ?? crypto.randomUUID()}:${type}`,
      type,
      p.call_control_id ?? null,
      p.call_leg_id ?? null,
      p.call_session_id ?? null,
      p.from ?? p.from_number ?? null,
      p.to ?? p.to_number ?? null,
      p.direction ?? null,
      JSON.stringify({ source_event_id: data.id, ...detail }),
    )
    .run();
}
async function contactForPhone(phone: string | null) {
  if (!phone) return null;
  const contacts = await env.DB.prepare(
    "SELECT id,phone FROM contacts WHERE phone IS NOT NULL",
  ).all<{ id: number; phone: string }>();
  return (
    contacts.results.find((c) => normalizePhone(c.phone) === phone)?.id ?? null
  );
}

async function createInboundFlow(
  event: TelnyxEvent,
  webhookUrl: string,
): Promise<Flow | null> {
  const p = event.data?.payload ?? {},
    callControlId =
      typeof p.call_control_id === "string" ? p.call_control_id : null,
    callSessionId =
      typeof p.call_session_id === "string" ? p.call_session_id : null,
    connectionId = typeof p.connection_id === "string" ? p.connection_id : null,
    caller = normalizePhone(p.from ?? p.from_number);
  if (!callControlId || !callSessionId || !connectionId || !caller) return null;
  const existing = await env.DB.prepare(
    "SELECT * FROM telnyx_call_flows WHERE call_session_id=?",
  )
    .bind(callSessionId)
    .first<Flow>();
  if (existing) return existing;
  const flowId = `inbound:${callSessionId}`,
    contactId = await contactForPhone(caller),
    startedAt =
      event.data?.occurred_at ??
      (typeof p.start_time === "string"
        ? p.start_time
        : new Date().toISOString());
  const communication = await env.DB.prepare(
    `INSERT INTO communications
    (contact_id,type,direction,occurred_at,external_provider_id,from_number,to_number,caller_number,destination_number,brad_cell_number,business_number,call_control_id,call_leg_id,related_call_leg_ids,started_at,status,subject)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`,
  )
    .bind(
      contactId,
      "Call",
      "incoming",
      startedAt,
      flowId,
      caller,
      BUSINESS_NUMBER,
      caller,
      BUSINESS_NUMBER,
      BRAD_CELL,
      BUSINESS_NUMBER,
      callControlId,
      p.call_leg_id ?? null,
      JSON.stringify(p.call_leg_id ? [p.call_leg_id] : []),
      startedAt,
      "Calling Brad",
      contactId ? "Inbound call" : `Unknown caller · ${caller}`,
    )
    .first<{ id: number }>();
  if (!communication) throw new Error("Could not create inbound Communication");
  await env.DB.prepare(
    `INSERT INTO telnyx_call_flows (id,communication_id,direction,contact_id,contact_number,call_session_id,primary_call_control_id,connection_id,status) VALUES (?,?,?,?,?,?,?,?,?)`,
  )
    .bind(
      flowId,
      communication.id,
      "incoming",
      contactId,
      caller,
      callSessionId,
      callControlId,
      connectionId,
      "Calling Brad",
    )
    .run();
  const flow = await env.DB.prepare(
    "SELECT * FROM telnyx_call_flows WHERE id=?",
  )
    .bind(flowId)
    .first<Flow>();
  try {
    const leg = await dialCall({
      to: BRAD_CELL,
      connectionId,
      webhookUrl,
      clientState: { flowId, role: "brad" },
      commandId: `${flowId}:brad`,
      linkTo: callControlId,
      record: true,
    });
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE telnyx_call_flows SET brad_call_control_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      ).bind(leg.call_control_id, flowId),
      env.DB.prepare(
        "UPDATE communications SET related_call_leg_ids=? WHERE id=?",
      ).bind(
        JSON.stringify([p.call_leg_id, leg.call_leg_id].filter(Boolean)),
        communication.id,
      ),
    ]);
    await saveControlEvent(event, "cell.route.dialed", {
      flow_id: flowId,
      brad_call_control_id: leg.call_control_id,
      brad_call_leg_id: leg.call_leg_id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Cell route failed";
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE telnyx_call_flows SET status='Failed',updated_at=CURRENT_TIMESTAMP WHERE id=?",
      ).bind(flowId),
      env.DB.prepare(
        "UPDATE communications SET status='Failed' WHERE id=?",
      ).bind(communication.id),
    ]);
    await saveControlEvent(event, "cell.route.failed", {
      flow_id: flowId,
      reason: message,
    });
  }
  return flow ?? null;
}
async function findFlow(p: Record<string, unknown>) {
  const state = decodeClientState(p.client_state);
  if (state)
    return {
      flow:
        (await env.DB.prepare("SELECT * FROM telnyx_call_flows WHERE id=?")
          .bind(state.flowId)
          .first<Flow>()) ?? null,
      role: state.role,
    };
  const session =
    typeof p.call_session_id === "string" ? p.call_session_id : null;
  if (!session) return { flow: null, role: null };
  const flow =
    (await env.DB.prepare(
      "SELECT * FROM telnyx_call_flows WHERE call_session_id=?",
    )
      .bind(session)
      .first<Flow>()) ?? null;
  return { flow, role: flow?.direction === "incoming" ? "inbound" : null };
}
async function addLeg(communicationId: number, legId: unknown) {
  if (typeof legId !== "string") return;
  const row = await env.DB.prepare(
    "SELECT related_call_leg_ids FROM communications WHERE id=?",
  )
    .bind(communicationId)
    .first<{ related_call_leg_ids: string | null }>();
  let legs: string[] = [];
  try {
    legs = JSON.parse(row?.related_call_leg_ids || "[]");
  } catch {
    legs = [];
  }
  if (!legs.includes(legId)) legs.push(legId);
  await env.DB.prepare(
    "UPDATE communications SET related_call_leg_ids=? WHERE id=?",
  )
    .bind(JSON.stringify(legs), communicationId)
    .run();
}

async function handleLifecycle(event: TelnyxEvent, webhookUrl: string) {
  const p = event.data?.payload ?? {},
    type = event.data?.event_type ?? "unknown",
    direction = String(p.direction ?? "").toLowerCase();
  if (
    type === "call.initiated" &&
    ["incoming", "inbound"].includes(direction) &&
    !decodeClientState(p.client_state)
  ) {
    await createInboundFlow(event, webhookUrl);
    return;
  }
  const { flow, role } = await findFlow(p);
  if (!flow) return;
  await addLeg(flow.communication_id, p.call_leg_id);
  const timestamp =
    event.data?.occurred_at ??
    (typeof p.end_time === "string" ? p.end_time : new Date().toISOString());
  if (type === "call.initiated") {
    const status = role === "contact" ? "Calling contact" : flow.status;
    await env.DB.prepare("UPDATE communications SET status=? WHERE id=?")
      .bind(status, flow.communication_id)
      .run();
  }
  if (
    type === "call.answered" &&
    role === "brad" &&
    flow.direction === "outgoing"
  ) {
    const claimed = await env.DB.prepare(
      `UPDATE telnyx_call_flows SET status='Brad answered',updated_at=CURRENT_TIMESTAMP WHERE id=? AND contact_call_control_id IS NULL`,
    )
      .bind(flow.id)
      .run();
    await env.DB.prepare(
      "UPDATE communications SET answered_at=?,status='Brad answered' WHERE id=?",
    )
      .bind(timestamp, flow.communication_id)
      .run();
    if ((claimed.meta.changes ?? 0) > 0 && flow.contact_number) {
      try {
        const contactLeg = await dialCall({
          to: flow.contact_number,
          connectionId: flow.connection_id,
          webhookUrl,
          clientState: { flowId: flow.id, role: "contact" },
          commandId: `${flow.id}:contact`,
          linkTo: String(p.call_control_id),
          record: true,
        });
        await env.DB.batch([
          env.DB.prepare(
            "UPDATE telnyx_call_flows SET contact_call_control_id=?,status='Calling contact',updated_at=CURRENT_TIMESTAMP WHERE id=?",
          ).bind(contactLeg.call_control_id, flow.id),
          env.DB.prepare(
            "UPDATE communications SET status='Calling contact' WHERE id=?",
          ).bind(flow.communication_id),
        ]);
      } catch (error) {
        console.error("Outbound contact leg failed", {
          flowId: flow.id,
          error: error instanceof Error ? error.message : error,
        });
        await env.DB.batch([
          env.DB.prepare(
            "UPDATE telnyx_call_flows SET status='Failed',updated_at=CURRENT_TIMESTAMP WHERE id=?",
          ).bind(flow.id),
          env.DB.prepare(
            "UPDATE communications SET status='Failed',ended_at=? WHERE id=?",
          ).bind(timestamp, flow.communication_id),
        ]);
      }
    }
  } else if (type === "call.answered") {
    const status = role === "contact" ? "Connected" : "Brad answered";
    await env.DB.prepare(
      "UPDATE communications SET answered_at=COALESCE(answered_at,?),status=? WHERE id=?",
    )
      .bind(timestamp, status, flow.communication_id)
      .run();
  }
  if (type === "call.bridged")
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE telnyx_call_flows SET status='Connected',updated_at=CURRENT_TIMESTAMP WHERE id=?",
      ).bind(flow.id),
      env.DB.prepare(
        "UPDATE communications SET bridged_at=COALESCE(bridged_at,?),status='Connected' WHERE id=?",
      ).bind(timestamp, flow.communication_id),
    ]);
  if (type === "call.hangup") {
    const duration =
      typeof p.call_duration_secs === "number" ? p.call_duration_secs : null;
    await env.DB.prepare(
      `UPDATE communications SET ended_at=COALESCE(ended_at,?),duration_seconds=COALESCE(duration_seconds,?,CAST((julianday(?) - julianday(started_at))*86400 AS INTEGER)),status=CASE WHEN status='Failed' THEN status ELSE 'Ended' END WHERE id=?`,
    )
      .bind(timestamp, duration, timestamp, flow.communication_id)
      .run();
    await env.DB.prepare(
      "UPDATE telnyx_call_flows SET status=CASE WHEN status='Failed' THEN status ELSE 'Ended' END,updated_at=CURRENT_TIMESTAMP WHERE id=?",
    )
      .bind(flow.id)
      .run();
  }
  if (type === "call.recording.saved") {
    const urls =
      p.recording_urls && typeof p.recording_urls === "object"
        ? (p.recording_urls as Record<string, unknown>)
        : {};
    const url =
      typeof urls.mp3 === "string"
        ? urls.mp3
        : typeof urls.wav === "string"
          ? urls.wav
          : null;
    const recordingId =
      typeof p.recording_id === "string" ? p.recording_id : null;
    await env.DB.prepare(
      `UPDATE communications SET recording_id=COALESCE(recording_id,?),recording_url=COALESCE(recording_url,?),duration_seconds=COALESCE(duration_seconds,?) WHERE id=?`,
    )
      .bind(
        recordingId,
        url,
        typeof p.duration_millis === "number"
          ? Math.round(p.duration_millis / 1000)
          : null,
        flow.communication_id,
      )
      .run();
  }
}
export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!(await verifyTelnyxSignature(request, rawBody)))
    return Response.json(
      { ok: false, error: "Invalid signature" },
      { status: 401 },
    );
  let event: TelnyxEvent;
  try {
    event = JSON.parse(rawBody) as TelnyxEvent;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const type = event.data?.event_type ?? "unknown",
    p = event.data?.payload ?? {};
  console.info("Telnyx voice event", {
    eventType: type,
    eventId: event.data?.id,
    callControlId: p.call_control_id,
    callSessionId: p.call_session_id,
  });
  if (!supportedEvents.has(type))
    console.info("Unhandled Telnyx voice event", { eventType: type });
  try {
    if (await saveVoiceEvent(event))
      waitUntil(
        handleLifecycle(event, request.url).catch((error) =>
          console.error("Telnyx lifecycle failed", error),
        ),
      );
  } catch (error) {
    console.error("Could not save Telnyx event", error);
  }
  return Response.json({ ok: true });
}
export function GET() {
  return Response.json(
    { ok: false, error: "Method not allowed" },
    { status: 405, headers: { Allow: "POST" } },
  );
}
