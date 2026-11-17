import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // Website submissions authenticate with their provider token in the route,
  // not a browser's ChatGPT session. Keep this exception exact and POST-only.
  if (request.method === "POST" && request.nextUrl.pathname === "/api/leads/inbound") {
    return NextResponse.next();
  }

  // Some embedded Sites requests include the authenticated email before the
  // stable user-id header is available. Treat either trusted dispatch header
  // as an authenticated ChatGPT request so the CRM does not enter a broken
  // sign-in redirect loop inside the editor.
  const isSignedIn = Boolean(
    request.headers.get("oai-authenticated-user-id") ||
      request.headers.get("oai-authenticated-user-email"),
  );
  if (isSignedIn) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const signInUrl = request.nextUrl.clone();
  signInUrl.pathname = "/signin-with-chatgpt";
  signInUrl.search = `?return_to=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: ["/((?!api/telnyx/voice|api/telnyx/sms|api/campaigns/unsubscribe|api/campaigns/run-due|api/telnyx/media/|u/|IABS-JLA.pdf|signin-with-chatgpt|signout-with-chatgpt|callback|_next|favicon.svg|sw.js|manifest.webmanifest).*)"],
};
