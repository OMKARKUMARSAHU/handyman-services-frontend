/**
 * Resolves the backend origin for code that may run either in the
 * browser or on the server (both `@/lib/auth/api` and `@/lib/data/live`
 * are imported by client components as well as server components, so
 * this can't be decided once at build time -- it has to branch at
 * runtime on where the code is actually executing).
 *
 * PHASE R root cause: the EB environment only serves the backend over
 * plain HTTP on port 80 (confirmed healthy via EB's own health checks
 * and a direct `curl http://<eb-host>/health` => 200). Port 443/TLS was
 * never configured on EB, so:
 *
 *  - a BROWSER can never be allowed to fetch the backend origin
 *    directly -- not https:// (nothing listens on 443, so the TCP
 *    connection itself times out, which is exactly the
 *    ERR_CONNECTION_TIMED_OUT/"Could not reach the server" failure this
 *    fixes) and not http:// either (blocked as mixed content, since the
 *    Vercel frontend is served over https://). Browser code must always
 *    go through the same-origin proxy at
 *    `src/app/api/backend/[...path]/route.ts` instead.
 *  - ordinary SERVER-SIDE code (a Next.js Server Component during SSR,
 *    or the proxy route handler itself) is not a browser and has no
 *    mixed-content or TLS-trust restriction, so it can -- and, until EB
 *    is given a real certificate/load balancer, MUST -- dial the
 *    backend's http:// origin on port 80 directly, regardless of
 *    whatever scheme happens to be configured in
 *    `NEXT_PUBLIC_API_BASE_URL`.
 *
 * This derives the working http:// origin from the existing
 * `NEXT_PUBLIC_API_BASE_URL` by normalizing its scheme, so the fix needs
 * no new Vercel environment variable and no Vercel dashboard change.
 */

const CONFIGURED_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

/**
 * Only ever fetch()-ed from server-side code (Server Components, the
 * `/api/backend/*` proxy route). This module is imported by files that
 * also run in the browser, so it must stay safe to include in a client
 * bundle -- but calling fetch() against this URL from the browser would
 * hit the same mixed-content/TLS wall this file exists to route around.
 */
export const DIRECT_BACKEND_BASE_URL = CONFIGURED_BASE_URL.replace(/^https:\/\//, "http://");

/**
 * Same-origin path the browser calls instead; proxied server-side to
 * DIRECT_BACKEND_BASE_URL by `src/app/api/backend/[...path]/route.ts`.
 */
export const BROWSER_PROXY_BASE_PATH = "/api/backend";

export function isBrowserRuntime(): boolean {
  return typeof window !== "undefined";
}
