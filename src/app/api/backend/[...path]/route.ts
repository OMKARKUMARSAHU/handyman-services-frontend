import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { DIRECT_BACKEND_BASE_URL } from "@/lib/server/backend-url";

/**
 * Same-origin proxy for every browser-side call to the backend's
 * `/api/v1/*` API (PHASE R -- "Vercel frontend cannot talk to the EB
 * backend over HTTPS").
 *
 * Root cause this works around: the EB environment only serves the
 * backend over plain HTTP on port 80 today (EB's own health checks are
 * 2XX, and `curl http://<eb-host>/health` returns 200 -- the Security
 * Group/port-80 path is confirmed fine and is NOT what this fixes).
 * Port 443/TLS was never configured on EB, so a browser fetch straight
 * from the HTTPS Vercel frontend to the backend's https:// URL times out
 * at the TCP level (nothing listens on 443) -- the ERR_CONNECTION_TIMED_OUT
 * / "Could not reach the server" failure. Falling back to the backend's
 * http:// URL from the browser would fail too, as mixed content on an
 * https:// page.
 *
 * This route runs as ordinary server-side Node code on Vercel, so it is
 * not a browser: a plain Node `fetch()` to the backend's http:// origin
 * has no TLS-trust or mixed-content restriction at all. Every browser-side
 * API call (`@/lib/auth/api`'s `apiRequest` -- staff login, customer
 * login, signup, password reset, and every admin/provider/customer
 * dashboard call built on it -- plus the `*Live` catalog lookups in
 * `@/lib/data/live` that run client-side from the checkout page) is
 * routed through this same-origin path instead of the backend URL
 * directly, so the browser only ever talks to Vercel's own already-
 * trusted HTTPS domain. See `@/lib/server/backend-url` for the client/
 * server branch that sends requests here.
 *
 * Auth cookies (`hs_at`/`hs_rt`/`hs_client`, set by
 * `backend/src/modules/auth/cookies.ts`) are forwarded both directions:
 * the browser's `Cookie` header is relayed to the backend on the way in,
 * and every `Set-Cookie` header the backend sends back is relayed
 * individually (not merged into one header, which would corrupt them) on
 * the way out, so the browser stores them exactly as if it had talked to
 * the backend directly -- except now over a connection it already trusts.
 *
 * This does not change the EB/ALB/ACM architecture, does not require any
 * new Vercel environment variable, and does not touch
 * `NEXT_PUBLIC_API_BASE_URL` or CORS_ALLOWED_ORIGINS on the backend (this
 * route's own fetch to the backend sends no `Origin` header, which the
 * backend's CORS config already allows -- see the `!origin` branch in
 * `backend/src/app.ts`).
 *
 * FULL WEBSITE AUDIT -- "changes are saved or published only after
 * navigation or browser refresh": every public-facing page (home, city,
 * category/product/service pages, /blog + article pages) is server-rendered
 * through the `*Live` readers in `@/lib/data/live.ts`, whose `backendGet()`
 * uses `next: { revalidate: 30 }` on the server -- a deliberate ISR-style
 * cache so public pages don't re-hit the backend on every single request.
 * The gap: nothing ever told Next to invalidate that cache (or the client
 * Router Cache) the moment an admin actually changes something, so a publish/
 * update/upload only became visible once that 30s window happened to lapse
 * on its own -- exactly the "only after refresh/navigate away" symptom,
 * site-wide, for every admin-authored surface (Blog, Catalog, Homepage
 * Content, Media -- anything `*Live` reads). This proxy is the one choke
 * point every admin write already passes through, so it's also the one
 * place to fix this correctly: once a mutating (`non-GET`) call to an
 * `/admin/*` or `/media/*` backend path succeeds, `revalidatePath("/",
 * "layout")` below invalidates Next's Data Cache *and* Router Cache for the
 * entire site, so the very next request -- including an in-app client
 * navigation, not just a hard refresh -- gets fresh data. This is real
 * server-side cache invalidation, not a forced full-page reload: nothing
 * about the current page's own already-rendered state changes, only what a
 * *subsequent* render/navigation fetches.
 */

export const dynamic = "force-dynamic";

const HOP_BY_HOP_REQUEST_HEADERS = new Set(["host", "connection", "content-length", "accept-encoding"]);

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const search = req.nextUrl.search;
  const targetUrl = `${DIRECT_BACKEND_BASE_URL}/${path.join("/")}${search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_REQUEST_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? Buffer.from(await req.arrayBuffer()) : undefined;

  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "NETWORK_ERROR", message: "Could not reach the backend." } },
      { status: 502 }
    );
  }

  const resHeaders = new Headers();
  backendRes.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower !== "set-cookie" && lower !== "content-encoding" && lower !== "content-length") {
      resHeaders.set(key, value);
    }
  });
  for (const cookie of backendRes.headers.getSetCookie?.() ?? []) {
    resHeaders.append("set-cookie", cookie);
  }

  const buf = await backendRes.arrayBuffer();

  // See this file's top doc comment ("FULL WEBSITE AUDIT"). Only a
  // successful write to an admin-authored path needs to bust the public
  // cache -- a GET never needs to (nothing changed), and customer/provider
  // self-service writes (cart, checkout, auth, `/me`, ...) never affect a
  // publicly cached page, so leaving those un-revalidated avoids pointlessly
  // invalidating the whole site's cache on every cart click.
  const isMutation = req.method !== "GET" && req.method !== "HEAD";
  const touchesAdminAuthoredContent = path[0] === "admin" || path[0] === "media";
  if (isMutation && touchesAdminAuthoredContent && backendRes.status >= 200 && backendRes.status < 300) {
    revalidatePath("/", "layout");
  }

  return new NextResponse(buf, { status: backendRes.status, headers: resHeaders });
}

type RouteParams = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  return proxy(req, (await params).path);
}
export async function POST(req: NextRequest, { params }: RouteParams) {
  return proxy(req, (await params).path);
}
export async function PUT(req: NextRequest, { params }: RouteParams) {
  return proxy(req, (await params).path);
}
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  return proxy(req, (await params).path);
}
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  return proxy(req, (await params).path);
}
