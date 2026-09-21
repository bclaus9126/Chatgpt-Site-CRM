import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await env.DB.prepare(
      `SELECT id,event_id,event_type,call_control_id,call_leg_id,
      call_session_id,from_number,to_number,direction,received_at
      FROM telnyx_events ORDER BY id DESC LIMIT 100`,
    ).all();
    return NextResponse.json({ events: result.results });
  } catch (error) {
    console.error("Could not load Telnyx events", error);
    return NextResponse.json(
      { error: "Telnyx events are temporarily unavailable." },
      { status: 500 },
    );
  }
}
