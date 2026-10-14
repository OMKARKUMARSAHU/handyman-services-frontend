// Regression tests for the city-switching bug (Products section / services disappearing or going stale
// when the city changes). They import the REAL modules the UI uses -- no mirrored copies -- and fake only
// the network (`globalThis.fetch`) for the live readers, so a regression in any of them fails here.
// Run: npx tsx scripts/verify-city-switching/city-switching.test.ts
import assert from "node:assert/strict";
import { BASE_KEY, cityKey, classifyHttpStatus, needsFetch, pickCityView } from "../../src/lib/city/cityView";
import { cityResultKey, createTtlCache } from "../../src/lib/city/ttlCache";
import { withRateLimitRetry } from "../../src/lib/city/retry";

let passed = 0;
const failures: string[] = [];
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push(name);
    console.log(`  FAIL ${name}\n       ${(err as Error).message}`);
  }
}

// ---------------------------------------------------------------------------------------------------------
// pickCityView: which city's data may be rendered
// ---------------------------------------------------------------------------------------------------------
async function viewTests() {
  const okFor = (key: string, tag: string) => ({ key, status: "ok" as const, data: tag });

  await test("server-rendered base view is used while no city is chosen", () => {
    assert.deepEqual(pickCityView({ citySlug: null, initialCity: null, initialOk: true, fetched: null }), { kind: "initial" });
  });

  await test("a chosen city is NEVER shown the base/server list: it loads (placeholder) until its own data arrives", () => {
    assert.deepEqual(pickCityView({ citySlug: "ranchi", initialCity: null, initialOk: true, fetched: null }), { kind: "loading" });
  });

  await test("Patna -> Ranchi: Patna's fetched data is not shown for Ranchi", () => {
    const v = pickCityView({ citySlug: "ranchi", initialCity: null, initialOk: true, fetched: okFor("patna", "PATNA") });
    assert.deepEqual(v, { kind: "loading" });
  });

  await test("Ranchi -> Patna: Patna's data is shown again once it is the selected city", () => {
    const v = pickCityView({ citySlug: "patna", initialCity: null, initialOk: true, fetched: okFor("patna", "PATNA") });
    assert.deepEqual(v, { kind: "ready", data: "PATNA" });
  });

  await test("/[city] page: the city-specific server render is used as-is for that exact city, and not for another", () => {
    assert.deepEqual(pickCityView({ citySlug: "ranchi", initialCity: "ranchi", initialOk: true, fetched: null }), { kind: "initial" });
    assert.deepEqual(pickCityView({ citySlug: "patna", initialCity: "ranchi", initialOk: true, fetched: null }), { kind: "loading" });
  });

  await test("a failed server render is not treated as an (empty) result: the browser fetches", () => {
    assert.equal(needsFetch({ citySlug: "ranchi", initialCity: "ranchi", initialOk: false }), true);
    assert.deepEqual(pickCityView({ citySlug: "ranchi", initialCity: "ranchi", initialOk: false, fetched: null }), { kind: "loading" });
  });

  await test("a failed fetch is an error state -- distinct from an empty successful result", () => {
    const err = pickCityView({ citySlug: "ranchi", initialCity: null, initialOk: true, fetched: { key: "ranchi", status: "error", kind: "failed" } });
    assert.deepEqual(err, { kind: "error", error: "failed" });
    const empty = pickCityView({ citySlug: "ranchi", initialCity: null, initialOk: true, fetched: { key: "ranchi", status: "ok", data: [] as string[] } });
    assert.deepEqual(empty, { kind: "ready", data: [] });
  });

  await test("an error for one city does not leak into another city's view", () => {
    const v = pickCityView({ citySlug: "patna", initialCity: null, initialOk: true, fetched: { key: "ranchi", status: "error", kind: "rate_limited" } });
    assert.deepEqual(v, { kind: "loading" });
  });

  await test("needsFetch is false only when the server render already covers the selected city", () => {
    assert.equal(needsFetch({ citySlug: null, initialCity: null, initialOk: true }), false);
    assert.equal(needsFetch({ citySlug: "patna", initialCity: "patna", initialOk: true }), false);
    assert.equal(needsFetch({ citySlug: "patna", initialCity: null, initialOk: true }), true);
  });

  await test("cityKey uses a reserved key for 'no city' that no real slug can collide with", () => {
    assert.equal(cityKey(null), BASE_KEY);
    assert.equal(cityKey("patna"), "patna");
    assert.ok(/^[a-z0-9-]+$/.test("patna") && !/^[a-z0-9-]+$/.test(BASE_KEY));
  });

  await test("HTTP statuses map to the right error kind", () => {
    assert.equal(classifyHttpStatus(429), "rate_limited");
    assert.equal(classifyHttpStatus(400), "city_unavailable");
    assert.equal(classifyHttpStatus(404), "city_unavailable");
    assert.equal(classifyHttpStatus(500), "failed");
    assert.equal(classifyHttpStatus(503), "failed");
  });
}

// ---------------------------------------------------------------------------------------------------------
// TTL cache: per-city keys, expiry, never mixing cities
// ---------------------------------------------------------------------------------------------------------
async function cacheTests() {
  await test("cache keys differ per city and per query", () => {
    assert.notEqual(cityResultKey("patna", "q"), cityResultKey("ranchi", "q"));
    assert.notEqual(cityResultKey("patna", "q1"), cityResultKey("patna", "q2"));
    assert.notEqual(cityResultKey(null, "q"), cityResultKey("patna", "q"));
  });

  await test("a cached city result is returned for that city only, and expires", () => {
    let now = 1_000;
    const cache = createTtlCache<string>(30_000, () => now);
    cache.set(cityResultKey("patna", "q"), "PATNA");
    assert.equal(cache.get(cityResultKey("patna", "q")), "PATNA");
    assert.equal(cache.get(cityResultKey("ranchi", "q")), undefined);
    now += 29_999;
    assert.equal(cache.get(cityResultKey("patna", "q")), "PATNA");
    now += 2;
    assert.equal(cache.get(cityResultKey("patna", "q")), undefined);
  });

  await test("the cache is bounded", () => {
    const cache = createTtlCache<number>(1_000, () => 0, 3);
    for (let i = 0; i < 10; i++) cache.set(`k${i}`, i);
    assert.equal(cache.size(), 3);
  });
}

// ---------------------------------------------------------------------------------------------------------
// 429 handling
// ---------------------------------------------------------------------------------------------------------
async function retryTests() {
  const is429 = (e: unknown) => (e as { status?: number })?.status === 429;
  const noSleep = async () => {};

  await test("HTTP 429 is retried exactly once", async () => {
    let calls = 0;
    const out = await withRateLimitRetry(
      async () => {
        calls++;
        if (calls === 1) throw { status: 429 };
        return "ok";
      },
      { isRateLimited: is429, sleep: noSleep }
    );
    assert.equal(out, "ok");
    assert.equal(calls, 2);
  });

  await test("a second 429 is reported, not retried forever", async () => {
    let calls = 0;
    await assert.rejects(
      withRateLimitRetry(
        async () => {
          calls++;
          throw { status: 429 };
        },
        { isRateLimited: is429, sleep: noSleep }
      )
    );
    assert.equal(calls, 2);
  });

  await test("other errors (e.g. 500) are not retried", async () => {
    let calls = 0;
    await assert.rejects(
      withRateLimitRetry(
        async () => {
          calls++;
          throw { status: 500 };
        },
        { isRateLimited: is429, sleep: noSleep }
      )
    );
    assert.equal(calls, 1);
  });

  await test("an aborted request is not retried", async () => {
    const controller = new AbortController();
    let calls = 0;
    await assert.rejects(
      withRateLimitRetry(
        async () => {
          calls++;
          controller.abort();
          throw { status: 429 };
        },
        { isRateLimited: is429, sleep: noSleep, signal: controller.signal }
      )
    );
    assert.equal(calls, 1);
  });
}

// ---------------------------------------------------------------------------------------------------------
// Live readers against a fake backend
// ---------------------------------------------------------------------------------------------------------
type Json = Record<string, unknown>;
const CITY_PATNA = { id: "11111111-1111-1111-1111-111111111111", name: "Patna", state: "Bihar", slug: "patna", isPopular: true, active: true, sortOrder: 1 };
const CITY_RANCHI = { id: "22222222-2222-2222-2222-222222222222", name: "Ranchi", state: "Jharkhand", slug: "ranchi", isPopular: true, active: true, sortOrder: 2 };
const CITY_NEW = { id: "33333333-3333-3333-3333-333333333333", name: "Gaya", state: "Bihar", slug: "gaya", isPopular: false, active: true, sortOrder: 3 };
const CITY_OFF = { id: "44444444-4444-4444-4444-444444444444", name: "Off City", state: "X", slug: "off-city", isPopular: false, active: false, sortOrder: 4 };

function svc(slug: string, offerPrice: number): Json {
  return {
    id: `svc-${slug}`, slug, productId: "prod-ac", serviceTypeId: "type-1", name: slug, shortDescription: "s", description: "d",
    whatsIncluded: [], images: [], mrp: offerPrice + 100, offerPrice, discountPercent: 0, discountAmount: 100, ratingAverage: null, ratingCount: 0,
    isMostBooked: true, availableCityIds: [], featured: true, active: true, sortOrder: 1,
  };
}

interface FakeBackend {
  calls: string[];
  /** services returned per cityId (the backend filters by city + resolves the city price) */
  servicesByCity: Record<string, Json[]>;
  failServices: number | null;
  cities: Json[];
  reachable: boolean;
}

function installFakeBackend(): FakeBackend {
  const fake: FakeBackend = {
    calls: [],
    servicesByCity: {
      [CITY_PATNA.id]: [svc("ac-service-patna", 499)],
      [CITY_RANCHI.id]: [svc("ac-service-ranchi", 399), svc("tv-service-ranchi", 299)],
      [CITY_NEW.id]: [svc("ac-service-gaya", 450)],
    },
    failServices: null,
    cities: [CITY_PATNA, CITY_RANCHI],
    reachable: true,
  };
  const reply = (status: number, body: Json) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/api\/v1/, "");
    fake.calls.push(path + url.search);
    if (!fake.reachable) throw new TypeError("fetch failed");
    if (path === "/cities") return reply(200, { success: true, data: fake.cities.filter((c) => c.active) });
    const bySlug = path.match(/^\/cities\/([^/]+)$/);
    if (bySlug) {
      const c = [...fake.cities, CITY_OFF].find((x) => x.slug === bySlug[1]);
      return c ? reply(200, { success: true, data: c }) : reply(404, { success: false });
    }
    if (path === "/categories")
      return reply(200, { success: true, data: [{ id: "cat-1", slug: "consumer-durables", name: "Consumer Durables", description: "", icon: "x", image: null, sortOrder: 1, active: true }] });
    if (path === "/service-types") return reply(200, { success: true, data: [{ id: "type-1", key: "repair" }] });
    if (path === "/categories/consumer-durables/products")
      return reply(200, { success: true, data: [{ id: "prod-ac", slug: "air-conditioner", name: "AC", description: "", icon: "x", image: null, categoryId: "cat-1", sortOrder: 1, active: true }] });
    if (path === "/services") {
      if (fake.failServices) return reply(fake.failServices, { success: false, error: { code: "X", message: "x" } });
      const cityId = url.searchParams.get("cityId");
      // The real backend returns ALL services when no cityId is sent -- this is what the old code silently did for an unknown city.
      const rows = cityId ? fake.servicesByCity[cityId] ?? [] : Object.values(fake.servicesByCity).flat();
      return reply(200, { success: true, data: rows });
    }
    return reply(404, { success: false });
  }) as typeof fetch;
  return fake;
}

async function liveTests() {
  process.env.NEXT_PUBLIC_API_BASE_URL = "http://backend.test/api/v1";
  const live = await import("../../src/lib/data/live");
  const fake = installFakeBackend();

  await test("a city's rails contain only that city's services (Patna vs Ranchi differ)", async () => {
    const patna = await live.getCityRailsStrict("patna");
    const ranchi = await live.getCityRailsStrict("ranchi");
    assert.equal(patna.status, "ok");
    assert.equal(ranchi.status, "ok");
    if (patna.status !== "ok" || ranchi.status !== "ok") return;
    assert.deepEqual(patna.data.featured.map((s) => s.slug), ["ac-service-patna"]);
    assert.deepEqual(ranchi.data.featured.map((s) => s.slug), ["ac-service-ranchi", "tv-service-ranchi"]);
    assert.equal(patna.data.citySlug, "patna");
    assert.equal(ranchi.data.citySlug, "ranchi");
    assert.equal(ranchi.data.featured[0]!.offerPrice, 399, "the city's own price is what is shown");
  });

  await test("Patna -> Ranchi -> Patna returns Patna's original results again", async () => {
    const first = await live.getCityRailsStrict("patna");
    await live.getCityRailsStrict("ranchi");
    const again = await live.getCityRailsStrict("patna");
    assert.deepEqual(again, first);
  });

  await test("an unknown city is reported as unknown -- NOT served the unfiltered catalog", async () => {
    const res = await live.getCityRailsStrict("atlantis");
    assert.deepEqual(res, { status: "unknown_city" });
    assert.deepEqual(await live.getFeaturedServicesLive("atlantis"), []);
    assert.deepEqual(await live.getServicesByCategoryLive("consumer-durables", { citySlug: "atlantis" }), []);
    assert.deepEqual(await live.getServicesByProductLive("air-conditioner", { citySlug: "atlantis" }), []);
    assert.equal(await live.getServiceDetailLive("ac-service-patna", { citySlug: "atlantis" }), null);
  });

  await test("a disabled city is treated as unknown", async () => {
    assert.deepEqual(await live.getCityRailsStrict("off-city"), { status: "unknown_city" });
  });

  await test("a city created in Admin AFTER the catalog was cached works without any code change", async () => {
    fake.cities = [CITY_PATNA, CITY_RANCHI, CITY_NEW];
    const res = await live.getCityRailsStrict("gaya");
    assert.equal(res.status, "ok");
    if (res.status === "ok") assert.deepEqual(res.data.featured.map((s) => s.slug), ["ac-service-gaya"]);
    assert.ok((await live.getServicesByCategoryLive("consumer-durables", { citySlug: "gaya" })).length === 1);
  });

  await test("a city with nothing available is a valid EMPTY result, not an error", async () => {
    fake.servicesByCity[CITY_NEW.id] = [];
    const res = await live.getCityRailsStrict("gaya");
    assert.equal(res.status, "ok");
    if (res.status === "ok") {
      assert.deepEqual(res.data.featured, []);
      assert.deepEqual(res.data.byCategory["consumer-durables"], []);
    }
  });

  await test("a backend error (e.g. HTTP 429) is reported as unavailable -- never replaced by bundled mock data", async () => {
    fake.failServices = 429;
    assert.deepEqual(await live.getCityRailsStrict("patna"), { status: "unavailable" });
    fake.failServices = 500;
    assert.deepEqual(await live.getCityRailsStrict("ranchi"), { status: "unavailable" });
    fake.failServices = null;
    const recovered = await live.getCityRailsStrict("patna");
    assert.equal(recovered.status, "ok");
  });

  await test("the city list comes from the backend (Admin-created cities included, disabled ones excluded)", async () => {
    fake.cities = [CITY_PATNA, CITY_RANCHI, CITY_NEW, CITY_OFF];
    const slugs = (await live.getCitiesLive()).map((c) => c.slug);
    assert.deepEqual(slugs, ["patna", "ranchi", "gaya"]);
    assert.equal((await live.getCityBySlugLive("gaya"))?.name, "Gaya");
    assert.equal(await live.getCityBySlugLive("off-city"), undefined);
    assert.equal(await live.getCityBySlugLive("atlantis"), undefined);
  });

  await test("the bundled city list is used only when the backend is unreachable", async () => {
    fake.reachable = false;
    const slugs = (await live.getCitiesLive()).map((c) => c.slug);
    assert.ok(slugs.includes("patna") && slugs.includes("ranchi"), "falls back to the bundled list");
    assert.ok(!slugs.includes("gaya"));
    fake.reachable = true;
  });

  await test("the home-rails route: 400 invalid slug, 404 unknown city, 503 failure (not cacheable), 200 per-city cacheable", async () => {
    const { GET } = await import("../../src/app/api/home-rails/route");
    const { NextRequest } = await import("next/server");
    const call = (city: string | null) => GET(new NextRequest(`http://localhost:3000/api/home-rails${city === null ? "" : `?city=${encodeURIComponent(city)}`}`));

    assert.equal((await call(null)).status, 400);
    assert.equal((await call("../etc/passwd")).status, 400);
    const unknown = await call("atlantis");
    assert.equal(unknown.status, 404);
    assert.equal(unknown.headers.get("cache-control"), "no-store");

    fake.failServices = 429;
    const failed = await call("patna");
    assert.equal(failed.status, 503);
    assert.equal(failed.headers.get("cache-control"), "no-store", "a failure must never be cached");
    fake.failServices = null;

    const ok = await call("Ranchi"); // slug is normalised
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as { citySlug: string; featured: { slug: string }[] };
    assert.equal(body.citySlug, "ranchi");
    assert.deepEqual(body.featured.map((s) => s.slug), ["ac-service-ranchi", "tv-service-ranchi"]);
    assert.match(ok.headers.get("cache-control") ?? "", /s-maxage=30/);
  });
}

(async () => {
  console.log("city view rules");
  await viewTests();
  console.log("city result cache");
  await cacheTests();
  console.log("429 handling");
  await retryTests();
  console.log("live readers (fake backend)");
  await liveTests();
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("Failed:\n - " + failures.join("\n - "));
    process.exit(1);
  }
})();
