import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Route-guard UX layer (AUTHENTICATION & AUTHORIZATION PHASE). This is NOT
 * the security boundary — it never verifies the JWT's signature, it only
 * decodes the payload to decide where to redirect a browser faster than a
 * blank/flashing page would. The REAL enforcement is, and always has been,
 * server-side: every backend route still runs `authenticate()` (real
 * Cognito JWKS signature/issuer/audience/expiry verification) and
 * `requireRole()` on every request, regardless of what this file decides.
 * (See backend/src/middleware/authenticate.ts / authorize.ts — unchanged by
 * this phase's frontend work.)
 *
 * Next.js 16 renamed the `middleware.js` convention to `proxy.js` — see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
 * This file intentionally uses that new convention/export name, not the
 * deprecated `middleware()`.
 */
function decodeGroupsUnverified(token: string): string[] {
  try {
    const payloadSegment = token.split(".")[1];
    if (!payloadSegment) return [];
    const json = Buffer.from(payloadSegment, "base64url").toString("utf8");
    const payload = JSON.parse(json) as { "cognito:groups"?: unknown };
    return Array.isArray(payload["cognito:groups"]) ? (payload["cognito:groups"] as string[]) : [];
  } catch {
    return [];
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get("hs_at")?.value;

  if (pathname.startsWith("/account")) {
    if (!accessToken) {
      return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname)}`, request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/provider")) {
    const groups = accessToken ? decodeGroupsUnverified(accessToken) : [];
    if (!accessToken || !groups.includes("provider")) {
      return NextResponse.redirect(new URL(`/staff/login?next=${encodeURIComponent(pathname)}`, request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    const groups = accessToken ? decodeGroupsUnverified(accessToken) : [];
    if (!accessToken || !groups.includes("admin")) {
      return NextResponse.redirect(new URL(`/staff/login?next=${encodeURIComponent(pathname)}`, request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/account", "/account/:path*", "/provider", "/provider/:path*", "/admin", "/admin/:path*"],
};
