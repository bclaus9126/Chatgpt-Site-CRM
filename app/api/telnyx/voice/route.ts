import { stopContact } from "@/lib/campaign";
import { env, waitUntil } from "cloudflare:workers";
import { indexPending } from "@/lib/claus-ai/indexer";
import {
  BRAD_CELL,
  BUSINESS_NUMBER,
  bridgeCalls,
  decodeClientState,
  dialCall,
  normalizePhone,
} from "@/lib/telnyx-call-control";
import { saveCallAnalysis } from "@/lib/call-analysis";
import { sendCallNotice } from "@/lib/telnyx-call-notice";

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
  "call.recording.transcription.saved",
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
export async function verifyTelnyxSignature(request: Request, rawBody: Uint8Array) {
  const publicKey = (env as unknown as { TELNYX_PUBLIC_KEY?: string })
    .TELNYX_PUBLIC_KEY;
  const signature = request.headers.get("telnyx-signature-ed25519"),
    timestamp = request.headers.get("telnyx-timestamp");
  const keyFormat = !publicKey ? "missing" : /^[0-9a-f]{64}$/i.test(publicKey) ? "hex" : /^[A-Za-z0-9+/]{43}=$/.test(publicKey) ? "base64" : "invalid";
  const diagnostics = { signaturePresent: Boolean(signature), timestampPresent: Boolean(timestamp), bodyBytes: rawBody.byteLength,
    timestamp: timestamp ?? null, keyFormat, keyHasWhitespace: Boolean(publicKey && /\s/.test(publicKey)),
    keyHasQuotes: Boolean(publicKey && /^["']|["']$/.test(publicKey)) };
  const reject = (reason: string) => {
    console.warn("Telnyx webhook signature rejected", { ...diagnostics, reason });
    return false;
  };
  if (!publicKey) return reject("public_key_missing");
  if (keyFormat === "invalid") return reject("public_key_format_invalid");
  if (!signature || !timestamp) return reject("signature_header_missing");
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) return reject("timestamp_invalid");
  if (Math.abs(Date.now() / 1000 - seconds) > 300) return reject("timestamp_outside_replay_window");
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      decodePublicKey(publicKey),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const prefix = new TextEncoder().encode(`${timestamp}|`);
    const signedPayload = new Uint8Array(prefix.byteLength + rawBody.byteLength);
    signedPayload.set(prefix);
    signedPayload.set(rawBody, prefix.byteLength);
    const verifiedLegacy = await crypto.subtle.verify(
      "Ed25519",
      key,
      decodeBase64(signature),
      signedPayload,
    );
    if (verifiedLegacy) return true;
    // Newer Telnyx deliveries also include Standard Webhooks metadata. Their
    // Ed25519 signature covers the webhook ID as well as the timestamp/body.
    const webhookId = request.headers.get("webhook-id");
    const webhookTimestamp = request.headers.get("webhook-timestamp");
    const webhookSignature = request.headers.get("webhook-signature");
    if (!webhookId || webhookTimestamp !== timestamp || !webhookSignature || webhookSignature !== signature) return reject("ed25519_signature_mismatch");
    const standardPrefix = new TextEncoder().encode(`${webhookId}.${timestamp}.`);
    const standardPayload = new Uint8Array(standardPrefix.byteLength + rawBody.byteLength);
    standardPayload.set(standardPrefix);
    standardPayload.set(rawBody, standardPrefix.byteLength);
    if (await crypto.subtle.verify("Ed25519", key, decodeBase64(webhookSignature), standardPayload)) return true;
    return reject("ed25519_signature_mismatch_both_formats");
  } catch (error) {
    return reject(error instanceof Error ? `verification_error_${error.name}` : "verification_error_unknown");
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
  if (!phone) return [];
  const contacts = await env.DB.prepare(
    "SELECT id,first_name,last_name,phone FROM contacts",
  ).all<{ id: number; first_name: string; last_name: string; phone: string }>();
  const methods = await env.DB.prepare("SELECT contact_id FROM contact_methods WHERE kind='phone' AND normalized_value=?").bind(phone).all<{contact_id:number}>();
  return contacts.results.filter(c => normalizePhone(c.phone) === phone || methods.results.some(m => m.contact_id === c.id));
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
    matches = await contactForPhone(caller),
    contactId = matches.length === 1 ? matches[0].id : null,
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
      contactId ? "Inbound call" : matches.length > 1 ? `Possible contact matches · ${caller}` : `Unknown caller · ${caller}`,
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
  waitUntil(sendCallNotice(env.DB,flowId,callSessionId,caller,matches).catch(() => console.error("Inbound call context notice failed")));
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
  if (!session) {
    const recordingId =
      typeof p.recording_id === "string" ? p.recording_id : null;
    if (!recordingId) return { flow: null, role: null };
    const recordingFlow =
      (await env.DB.prepare(
        `SELECT f.* FROM telnyx_call_flows f JOIN communications c ON c.id=f.communication_id WHERE c.recording_id=?`,
      )
        .bind(recordingId)
        .first<Flow>()) ?? null;
    return { flow: recordingFlow, role: null };
  }
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

async function archiveCallRecording(communicationId: number, recordingId: string | null, url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not archive call recording (${response.status})`);
  const contentType = response.headers.get("content-type") || "audio/mpeg";
  const key = `call-recordings/${communicationId}/${recordingId || crypto.randomUUID()}.mp3`;
  await env.FILES.put(key, response.body, { httpMetadata: { contentType } });
  await env.DB.prepare("UPDATE communications SET audio_object_key=?,audio_content_type=? WHERE id=?")
    .bind(key, contentType, communicationId).run();
}

async function analyzeCallTranscript(flow: Flow, transcript: string, transcriptionCallControlId: string | null) {
  const call = await env.DB.prepare(`SELECT c.occurred_at,c.message_transcript,TRIM(COALESCE(ct.first_name,'') || ' ' || COALESCE(ct.last_name,'')) contact_name
    FROM communications c LEFT JOIN contacts ct ON ct.id=c.contact_id WHERE c.id=?`)
    .bind(flow.communication_id).first<{ occurred_at: string; message_transcript: string | null; contact_name: string }>();
  if (call?.message_transcript && call.message_transcript.length > transcript.length) return;
  const recordingRole = transcriptionCallControlId === flow.brad_call_control_id ? "brad" : transcriptionCallControlId === flow.contact_call_control_id ? "contact" : null;
  await saveCallAnalysis(env.DB, flow.communication_id, { transcript, contactName: call?.contact_name || "Contact", occurredAt: call?.occurred_at || new Date().toISOString(), recordingRole });
  waitUntil(indexPending(env.DB,1,false,`communication:${flow.communication_id}`).catch(()=>console.error("Call indexing deferred")));
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
  } else if (
    type === "call.answered" &&
    role === "brad" &&
    flow.direction === "incoming" &&
    flow.primary_call_control_id
  ) {
    try {
      await bridgeCalls({
        callControlId: String(p.call_control_id),
        targetCallControlId: flow.primary_call_control_id,
        commandId: `${flow.id}:bridge`,
      });
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE telnyx_call_flows SET status='Bridging',updated_at=CURRENT_TIMESTAMP WHERE id=?",
        ).bind(flow.id),
        env.DB.prepare(
          "UPDATE communications SET answered_at=COALESCE(answered_at,?),status='Bridging' WHERE id=?",
        ).bind(timestamp, flow.communication_id),
      ]);
      await saveControlEvent(event, "cell.route.bridge_requested", {
        flow_id: flow.id,
        inbound_call_control_id: flow.primary_call_control_id,
        brad_call_control_id: p.call_control_id,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not bridge inbound call";
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE telnyx_call_flows SET status='Failed',updated_at=CURRENT_TIMESTAMP WHERE id=?",
        ).bind(flow.id),
        env.DB.prepare(
          "UPDATE communications SET status='Failed',ended_at=? WHERE id=?",
        ).bind(timestamp, flow.communication_id),
      ]);
      await saveControlEvent(event, "cell.route.bridge_failed", {
        flow_id: flow.id,
        reason: message,
      });
    }
  } else if (
    type === "call.answered" &&
    role === "contact" &&
    flow.direction === "outgoing" &&
    flow.brad_call_control_id
  ) {
    try {
      await bridgeCalls({
        callControlId: String(p.call_control_id),
        targetCallControlId: flow.brad_call_control_id,
        commandId: `${flow.id}:bridge`,
      });
      await env.DB.batch([
        env.DB.prepare("UPDATE telnyx_call_flows SET status='Bridging',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(flow.id),
        env.DB.prepare("UPDATE communications SET status='Bridging' WHERE id=?").bind(flow.communication_id),
      ]);
      await saveControlEvent(event, "outbound.bridge_requested", {
        flow_id: flow.id,
        contact_call_control_id: p.call_control_id,
        brad_call_control_id: flow.brad_call_control_id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not bridge outbound call";
      await env.DB.batch([
        env.DB.prepare("UPDATE telnyx_call_flows SET status='Failed',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(flow.id),
        env.DB.prepare("UPDATE communications SET status='Failed',ended_at=? WHERE id=?").bind(timestamp, flow.communication_id),
      ]);
      await saveControlEvent(event, "outbound.bridge_failed", { flow_id: flow.id, reason: message });
    }
  } else if (type === "call.answered") {
    const status = role === "contact" ? "Contact answered" : "Brad answered";
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
    if (url) await archiveCallRecording(flow.communication_id, recordingId, url);
  }
  if (type === "call.recording.transcription.saved") {
    const transcript =
      typeof p.transcription_text === "string"
        ? p.transcription_text.trim()
        : "";
    if (transcript) {
      await env.DB.prepare("UPDATE communications SET recording_id=COALESCE(recording_id,?) WHERE id=?")
        .bind(typeof p.recording_id === "string" ? p.recording_id : null, flow.communication_id).run();
      await analyzeCallTranscript(flow, transcript, typeof p.call_control_id === "string" ? p.call_control_id : null);
      if (flow.contact_id && transcript.length > 25) await stopContact(Number(flow.contact_id),"Answered call");
    }
  }
}
export async function POST(request: Request) {
  const rawBody = new Uint8Array(await request.arrayBuffer());
  if (!(await verifyTelnyxSignature(request, rawBody)))
    return Response.json(
      { ok: false, error: "Invalid signature" },
      { status: 401 },
    );
  let event: TelnyxEvent;
  try {
    event = JSON.parse(new TextDecoder().decode(rawBody)) as TelnyxEvent;
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
