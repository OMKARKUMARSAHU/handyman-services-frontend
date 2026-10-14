import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCategoriesLive, getFeaturedServicesLive, getMostBookedServicesLive, getServicesByCategoryLive } from "@/lib/data/live";

/**
 * City-resolved service rails for the city-agnostic "/" homepage.
 *
 * "/" only learns the visitor's city in the browser (localStorage), so
 * `HomeDiscoveryRails` asks this route for that city's rails instead of
 * calling the backend itself. Doing the fetching here means:
 *  - every price is the SELECTED CITY's price (the live readers pass the
 *    city to the backend, which returns that city's custom price, or the
 *    base price when the city has none) — the same data `/[city]` renders;
 *  - the backend is hit through the server-side `revalidate: 30` fetch
 *    cache shared by all visitors, not ~20 uncached browser requests per
 *    page view (which would eat the backend's per-IP rate limit);
 *  - the live readers still fall back to the bundled catalog if the backend
 *    is unreachable, exactly like every other page.
 * Read-only; takes only a city slug; carries no auth and no price input.
 */
export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city");
  if (!city || !/^[a-z0-9-]{1,100}$/.test(city)) {
    return NextResponse.json({ error: "A valid city slug is required." }, { status: 400 });
  }
  const categories = await getCategoriesLive();
  const [featured, mostBooked, ...perCategory] = await Promise.all([
    getFeaturedServicesLive(city),
    getMostBookedServicesLive(city),
    ...categories.map((c) => getServicesByCategoryLive(c.id, { citySlug: city, limit: 10 })),
  ]);
  const byCategory: Record<string, unknown> = {};
  categories.forEach((c, i) => {
    byCategory[c.id] = perCategory[i] ?? [];
  });
  return NextResponse.json(
    { citySlug: city, featured, mostBooked, byCategory },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60" } }
  );
}
