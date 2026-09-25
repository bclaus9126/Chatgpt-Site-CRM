import { env } from "cloudflare:workers";

export const BRAD_CELL = String((env as unknown as Record<string, string>).BRAD_CELL || "");
export const BUSINESS_NUMBER = String((env as unknown as Record<string, string>).TELNYX_BUSINESS_NUMBER || "");
export const VOICE_CONNECTION_ID = "3053942566882903353";

export type CallClientState = {
  flowId: string;
  role: "inbound" | "brad" | "contact";
};

export function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function encodeClientState(value: CallClientState): string {
  return btoa(JSON.stringify(value));
}

export function decodeClientState(value: unknown): CallClientState | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const parsed = JSON.parse(atob(value)) as CallClientState;
    return parsed.flowId && ["inbound", "brad", "contact"].includes(parsed.role)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export async function dialCall(input: {
  to: string;
  connectionId: string;
  webhookUrl: string;
  clientState: CallClientState;
  commandId: string;
  linkTo?: string;
  record?: boolean;
}) {
  const apiKey = (env as unknown as { TELNYX_API_KEY?: string }).TELNYX_API_KEY;
  if (!apiKey) throw new Error("TELNYX_API_KEY is not configured");
  const response = await fetch("https://api.telnyx.com/v2/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      connection_id: input.connectionId,
      from: BUSINESS_NUMBER,
      to: input.to,
      bridge_intent: Boolean(input.linkTo),
      ...(input.linkTo ? { link_to: input.linkTo } : {}),
      command_id: input.commandId,
      client_state: encodeClientState(input.clientState),
      webhook_url: input.webhookUrl,
      webhook_url_method: "POST",
      ...(input.record
        ? {
            record: "record-from-answer",
            record_channels: "dual",
            record_format: "mp3",
            record_track: "both",
            transcription: true,
            transcription_config: {
              transcription_engine: "Google",
              transcription_tracks: "both",
              transcription_engine_config: {
                transcription_engine: "Google",
                language: "en",
                enable_speaker_diarization: true,
                min_speaker_count: 2,
                max_speaker_count: 2,
              },
            },
          }
        : {}),
    }),
  });
  const result = (await response.json().catch(() => null)) as {
    data?: {
      call_control_id?: string;
      call_leg_id?: string;
      call_session_id?: string;
      recording_id?: string;
    };
    errors?: unknown;
  } | null;
  if (!response.ok || !result?.data?.call_control_id) {
    console.error("Telnyx dial failed", {
      to: input.to,
      status: response.status,
      errors: result?.errors,
    });
    throw new Error(`Telnyx could not start the call (${response.status})`);
  }
  return result.data;
}

export async function bridgeCalls(input: {
  callControlId: string;
  targetCallControlId: string;
  commandId: string;
}) {
  const apiKey = (env as unknown as { TELNYX_API_KEY?: string }).TELNYX_API_KEY;
  if (!apiKey) throw new Error("TELNYX_API_KEY is not configured");
  const response = await fetch(
    `https://api.telnyx.com/v2/calls/${encodeURIComponent(input.callControlId)}/actions/bridge`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        call_control_id: input.targetCallControlId,
        command_id: input.commandId,
      }),
    },
  );
  const result = (await response.json().catch(() => null)) as {
    data?: { result?: string };
    errors?: unknown;
  } | null;
  if (!response.ok) {
    console.error("Telnyx bridge failed", {
      callControlId: input.callControlId,
      targetCallControlId: input.targetCallControlId,
      status: response.status,
      errors: result?.errors,
    });
    throw new Error(`Telnyx could not bridge the call (${response.status})`);
  }
  return result?.data;
}
