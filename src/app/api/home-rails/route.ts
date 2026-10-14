import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCityRailsStrict } from "@/lib/data/live";

/**
 * City-resolved service rails for the city-agnostic "/" homepage.
 *
 * "/" only learns the visitor's city in the browser (localStorage), so `HomeDiscoveryRails` asks this route
 * for that city's rails instead of calling the backend itself. Doing the fetching here means:
 *  - every price is the SELECTED CITY's price (the backend returns the city's custom price, or the base price
 *    when the city has none) and only services actually available in that city — the same data `/[city]`
 *    renders;
 *  - the backend is hit through the server-side `revalidate: 30` fetch cache shared by all visitors, not ~20
 *    uncached browser requests per page view (which would eat the backend's per-IP rate limit);
 *  - the response is cached PER CITY: the cache key is this URL, whose `city` query parameter is the
 *    normalized slug (validated below), so one city's rails can never be served for another.
 *
 * Failures are reported as failures, never papered over:
 *  - backend unreachable / rate-limited / erroring  -> 503 `RAILS_UNAVAILABLE`, `no-store` (a failure must not
 *    be cached or confused with "no services"); the page keeps whatever it already showed and offers a retry;
 *  - city unknown to (or disabled in) the backend    -> 404 `CITY_NOT_FOUND`, `no-store`;
 *  - an empty-but-valid result                      -> 200 with empty arrays (a city with nothing available).
 * The bundled mock catalog is NEVER substituted here. Read-only; takes only a city slug; no auth, no price input.
 */
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("city");
  const city = raw?.trim().toLowerCase();
  if (!city || !/^[a-z0-9-]{1,100}$/.test(city)) {
    return NextResponse.json({ error: { code: "INVALID_CITY", message: "A valid city slug is required." } }, { status: 400, headers: NO_STORE });
  }
  const result = await getCityRailsStrict(city);
  if (result.status === "unknown_city") {
    return NextResponse.json({ error: { code: "CITY_NOT_FOUND", message: "That city is not available." } }, { status: 404, headers: NO_STORE });
  }
  if (result.status === "unavailable") {
    return NextResponse.json({ error: { code: "RAILS_UNAVAILABLE", message: "Services could not be loaded right now." } }, { status: 503, headers: NO_STORE });
  }
  return NextResponse.json(result.data, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60" },
  });
}
