import { storedImage } from "@/lib/telnyx-media";

export const dynamic = "force-dynamic";
// Random, unguessable media URLs must be accessible to Telnyx at send time.
export async function GET(_request: Request, { params }: { params: Promise<{token: string}> }) {
  const object = await storedImage((await params).token);
  if (!object) return new Response(null, { status: 404 });
  return new Response(object.body, { headers: {
    "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
    "Content-Length": String(object.size),
    "Cache-Control": "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  } });
}
