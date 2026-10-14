import { randomUUID } from "node:crypto";
import { testAgent } from "../helpers/testApp";
import { resetDatabase } from "../helpers/db";
import { bearer, mintToken } from "../helpers/cognitoTestKit";
import { seedCatalogBasics, seedOffer, seedService } from "../helpers/factories";
import { createCity } from "../../src/modules/cities/cities.service";
import { getDb } from "../../src/database/db";

/**
 * City-wise pricing for SERVICES. A city's own MRP/offer price lives on the
 * same `service_city_availability` row as its availability; empty = base
 * price; pricing must never change availability; cart/order prices are
 * always re-derived on the server for the item's own city.
 */
describe("service city-wise pricing", () => {
  const adminToken = mintToken({ role: "admin" });
  const customerToken = mintToken({ role: "customer", sub: "abababab-abab-4bab-8bab-abababababab" });

  beforeEach(async () => {
    await resetDatabase();
  });

  async function newCity(name: string) {
    return createCity({ name, state: "Test State", slug: `${name.toLowerCase()}-${randomUUID().slice(0, 6)}` });
  }

  async function setAvailability(serviceId: string, cities: { cityId: string; active: boolean }[]) {
    return testAgent().put(`/api/v1/admin/services/${serviceId}/city-availability`).set("Authorization", bearer(adminToken)).send({ cities });
  }

  async function setPricing(serviceId: string, cities: { cityId: string; mrp: number | null; offerPrice: number | null }[]) {
    return testAgent().put(`/api/v1/admin/services/${serviceId}/city-pricing`).set("Authorization", bearer(adminToken)).send({ cities });
  }

  async function fixture() {
    const { product, serviceType, city: ranchi } = await seedCatalogBasics();
    const mumbai = await newCity("Mumbai");
    const delhi = await newCity("Delhi");
    const patna = await newCity("Patna");
    const service = await seedService({ productId: product.id, serviceTypeId: serviceType.id, mrp: 710, offerPrice: 600, approve: true });
    await setAvailability(service.id, [ranchi, mumbai, delhi, patna].map((c) => ({ cityId: c.id, active: true })));
    return { service, ranchi, mumbai, delhi, patna };
  }

  it("requires an admin to set city prices", async () => {
    const { service, ranchi } = await fixture();
    const body = { cities: [{ cityId: ranchi.id, mrp: 800, offerPrice: 700 }] };
    const anon = await testAgent().put(`/api/v1/admin/services/${service.id}/city-pricing`).send(body);
    expect(anon.status).toBe(401);
    const customer = await testAgent().put(`/api/v1/admin/services/${service.id}/city-pricing`).set("Authorization", bearer(customerToken)).send(body);
    expect(customer.status).toBe(403);
  });

  it("stores different prices per city and returns each city's price, while other cities use the base price", async () => {
    const { service, ranchi, mumbai, delhi, patna } = await fixture();
    const saved = await setPricing(service.id, [
      { cityId: ranchi.id, mrp: 800, offerPrice: 700 },
      { cityId: mumbai.id, mrp: 900, offerPrice: 800 },
      { cityId: delhi.id, mrp: 750, offerPrice: 650 },
    ]);
    expect(saved.status).toBe(200);
    expect(saved.body.data).toHaveLength(3);

    const get = async (cityId?: string) =>
      (await testAgent().get(`/api/v1/services/${service.slug}${cityId ? `?cityId=${cityId}` : ""}`)).body.data;

    const r = await get(ranchi.id);
    expect([r.mrp, r.offerPrice, r.finalPrice, r.priceSource]).toEqual([800, 700, 700, "city"]);
    const m = await get(mumbai.id);
    expect([m.mrp, m.offerPrice, m.priceSource]).toEqual([900, 800, "city"]);
    const d = await get(delhi.id);
    expect([d.mrp, d.offerPrice]).toEqual([750, 650]);
    // Patna has no custom price -> base; no city given -> base.
    const p = await get(patna.id);
    expect([p.mrp, p.offerPrice, p.priceSource]).toEqual([710, 600, "base"]);
    const none = await get();
    expect([none.mrp, none.offerPrice, none.priceSource]).toEqual([710, 600, "base"]);
  });

  it("lets several cities share the same price", async () => {
    const { service, ranchi, delhi, mumbai } = await fixture();
    await setPricing(service.id, [
      { cityId: delhi.id, mrp: 750, offerPrice: 650 },
      { cityId: mumbai.id, mrp: 750, offerPrice: 650 },
      { cityId: ranchi.id, mrp: 750, offerPrice: 650 },
    ]);
    for (const c of [delhi, mumbai, ranchi]) {
      const res = await testAgent().get(`/api/v1/services/${service.slug}?cityId=${c.id}`);
      expect(res.body.data.offerPrice).toBe(650);
    }
  });

  it("applies city prices to the catalog listing and sorts by the city's own price", async () => {
    const { product, serviceType, city } = await seedCatalogBasics();
    const cheapBase = await seedService({ productId: product.id, serviceTypeId: serviceType.id, cityId: city.id, mrp: 500, offerPrice: 400, approve: true });
    const dearBase = await seedService({ productId: product.id, serviceTypeId: serviceType.id, cityId: city.id, mrp: 900, offerPrice: 800, approve: true });
    // In this city the "cheap" service is configured dearer than the other one.
    await setPricing(cheapBase.id, [{ cityId: city.id, mrp: 1500, offerPrice: 1200 }]);

    const res = await testAgent().get(`/api/v1/services?cityId=${city.id}&sort=offerPrice&order=asc`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((s: { id: string; offerPrice: number }) => [s.id, s.offerPrice])).toEqual([
      [dearBase.id, 800],
      [cheapBase.id, 1200],
    ]);
    // Without a city the base prices (and base ordering) apply.
    const base = await testAgent().get("/api/v1/services?sort=offerPrice&order=asc");
    expect(base.body.data.map((s: { offerPrice: number }) => s.offerPrice)).toEqual([400, 800]);
  });

  it("treats empty prices as 'use base' and clearing restores base pricing (never zero)", async () => {
    const { service, ranchi } = await fixture();
    await setPricing(service.id, [{ cityId: ranchi.id, mrp: 800, offerPrice: 700 }]);
    const cleared = await setPricing(service.id, [{ cityId: ranchi.id, mrp: null, offerPrice: null }]);
    expect(cleared.status).toBe(200);
    expect(cleared.body.data).toHaveLength(0);
    const res = await testAgent().get(`/api/v1/services/${service.slug}?cityId=${ranchi.id}`);
    expect([res.body.data.mrp, res.body.data.offerPrice, res.body.data.priceSource]).toEqual([710, 600, "base"]);
  });

  it("validates prices: both-or-neither, non-negative, offer <= MRP, no duplicate cities", async () => {
    const { service, ranchi } = await fixture();
    const bad = async (entry: unknown) =>
      (await testAgent().put(`/api/v1/admin/services/${service.id}/city-pricing`).set("Authorization", bearer(adminToken)).send({ cities: [entry] })).status;
    expect(await bad({ cityId: ranchi.id, mrp: 800, offerPrice: null })).toBe(400);
    expect(await bad({ cityId: ranchi.id, mrp: null, offerPrice: 700 })).toBe(400);
    expect(await bad({ cityId: ranchi.id, mrp: 600, offerPrice: 700 })).toBe(400);
    expect(await bad({ cityId: ranchi.id, mrp: -1, offerPrice: -5 })).toBe(400);
    expect(await bad({ cityId: ranchi.id, mrp: 100, offerPrice: -5 })).toBe(400);
    expect(await bad({ cityId: ranchi.id, mrp: "abc", offerPrice: 1 })).toBe(400);
    const dup = await testAgent()
      .put(`/api/v1/admin/services/${service.id}/city-pricing`)
      .set("Authorization", bearer(adminToken))
      .send({ cities: [{ cityId: ranchi.id, mrp: 10, offerPrice: 5 }, { cityId: ranchi.id, mrp: 10, offerPrice: 5 }] });
    expect(dup.status).toBe(400);
    // Equal MRP and offer is fine (no discount).
    expect(await bad({ cityId: ranchi.id, mrp: 700, offerPrice: 700 })).toBe(200);
    // The database itself also refuses an invalid pair (defence in depth).
    await expect(
      getDb()("service_city_availability").where({ service_id: service.id, city_id: ranchi.id }).update({ mrp: 10, offer_price: 20 })
    ).rejects.toBeDefined();
  });

  it("404s for an unknown service or city", async () => {
    const { service } = await fixture();
    const unknownService = await setPricing(randomUUID(), [{ cityId: randomUUID(), mrp: 10, offerPrice: 5 }]);
    expect(unknownService.status).toBe(404);
    const unknownCity = await setPricing(service.id, [{ cityId: randomUUID(), mrp: 10, offerPrice: 5 }]);
    expect(unknownCity.status).toBe(404);
  });

  it("never makes a service available in a city just because a price was configured", async () => {
    const { product, serviceType, city: enabledCity } = await seedCatalogBasics();
    const otherCity = await newCity("Kolkata");
    const service = await seedService({ productId: product.id, serviceTypeId: serviceType.id, cityId: enabledCity.id, mrp: 710, offerPrice: 600, approve: true });
    await setAvailability(service.id, [{ cityId: otherCity.id, active: false }]);

    // Price for a city with an explicitly-disabled row, and for one with no row at all.
    const unseenCity = await newCity("Pune");
    await setPricing(service.id, [
      { cityId: otherCity.id, mrp: 900, offerPrice: 800 },
      { cityId: unseenCity.id, mrp: 900, offerPrice: 800 },
    ]);

    for (const c of [otherCity, unseenCity]) {
      const detail = await testAgent().get(`/api/v1/services/${service.slug}?cityId=${c.id}`);
      expect(detail.status).toBe(404);
      const list = await testAgent().get(`/api/v1/services?cityId=${c.id}`);
      expect(list.body.data).toHaveLength(0);
      const cart = await testAgent().post("/api/v1/customer/cart/items").set("Authorization", bearer(customerToken)).send({ serviceId: service.id, cityId: c.id, quantity: 1 });
      expect(cart.status).toBe(409);
    }
    const rows = await getDb()("service_city_availability").where({ service_id: service.id }).select("city_id", "active");
    const activeByCity = new Map(rows.map((r: { city_id: string; active: number }) => [r.city_id, Boolean(r.active)]));
    expect(activeByCity.get(enabledCity.id)).toBe(true);
    expect(activeByCity.get(otherCity.id)).toBe(false);
    expect(activeByCity.get(unseenCity.id)).toBe(false);
  });

  it("keeps prices when availability is saved, and availability when prices are saved", async () => {
    const { service, ranchi, mumbai } = await fixture();
    await setPricing(service.id, [{ cityId: ranchi.id, mrp: 800, offerPrice: 700 }]);
    // Toggle Ranchi off and Mumbai stays on, via the existing availability endpoint.
    await setAvailability(service.id, [{ cityId: ranchi.id, active: false }, { cityId: mumbai.id, active: true }]);
    const row = await getDb()("service_city_availability").where({ service_id: service.id, city_id: ranchi.id }).first();
    expect([Boolean(row.active), Number(row.mrp), Number(row.offer_price)]).toEqual([false, 800, 700]);
    // Re-enable: the saved price is still there.
    await setAvailability(service.id, [{ cityId: ranchi.id, active: true }]);
    const res = await testAgent().get(`/api/v1/services/${service.slug}?cityId=${ranchi.id}`);
    expect(res.body.data.offerPrice).toBe(700);
  });

  it("exposes base prices plus every city's custom price to the admin, and not to the public DTO", async () => {
    const { service, ranchi, mumbai } = await fixture();
    await setPricing(service.id, [{ cityId: ranchi.id, mrp: 800, offerPrice: 700 }, { cityId: mumbai.id, mrp: 900, offerPrice: 800 }]);
    const queue = await testAgent().get("/api/v1/admin/listings/pending?status=approved").set("Authorization", bearer(adminToken));
    const managed = queue.body.data.find((s: { id: string }) => s.id === service.id);
    expect([managed.mrp, managed.offerPrice]).toEqual([710, 600]); // base prices stay base
    expect(managed.cityPrices).toEqual(expect.arrayContaining([
      { cityId: ranchi.id, mrp: 800, offerPrice: 700 },
      { cityId: mumbai.id, mrp: 900, offerPrice: 800 },
    ]));
    expect(managed.cityPrices).toHaveLength(2);
    const pub = await testAgent().get(`/api/v1/services/${service.slug}`);
    expect(pub.body.data.cityPrices).toBeUndefined();
  });

  it("a newly created city can be priced immediately (no hardcoded city list)", async () => {
    const { service } = await fixture();
    const brandNew = await newCity("Lucknow");
    await setAvailability(service.id, [{ cityId: brandNew.id, active: true }]);
    const saved = await setPricing(service.id, [{ cityId: brandNew.id, mrp: 640, offerPrice: 560 }]);
    expect(saved.status).toBe(200);
    const res = await testAgent().get(`/api/v1/services/${service.slug}?cityId=${brandNew.id}`);
    expect(res.body.data.offerPrice).toBe(560);
  });

  it("combines the city price with the effective Offer exactly like the base price", async () => {
    const { service, ranchi } = await fixture();
    await setPricing(service.id, [{ cityId: ranchi.id, mrp: 800, offerPrice: 700 }]);
    await seedOffer({ discountType: "flat", discountValue: 100, applicabilityType: "all_india" });
    const res = await testAgent().get(`/api/v1/services/${service.slug}?cityId=${ranchi.id}`);
    expect([res.body.data.offerPrice, res.body.data.offerDiscountAmount, res.body.data.finalPrice, res.body.data.totalDiscountAmount]).toEqual([700, 100, 600, 200]);
  });

  describe("cart and checkout", () => {
    async function addToCart(serviceId: string, cityId: string, quantity = 1, extra: Record<string, unknown> = {}) {
      return testAgent().post("/api/v1/customer/cart/items").set("Authorization", bearer(customerToken)).send({ serviceId, cityId, quantity, ...extra });
    }

    async function address() {
      const res = await testAgent().post("/api/v1/customer/addresses").set("Authorization", bearer(customerToken)).send({ label: "Home", line1: "221B Test Lane", city: "Testville", state: "TS", pincode: "560001" });
      return res.body.data.id as string;
    }

    it("prices the cart with the item's own city price, ignoring any client-sent price", async () => {
      const { service, ranchi, patna } = await fixture();
      await setPricing(service.id, [{ cityId: ranchi.id, mrp: 800, offerPrice: 700 }]);
      const r = await addToCart(service.id, ranchi.id, 2, { unitPrice: 1, offerPrice: 1, price: 1 });
      expect(r.status).toBe(201);
      const p = await addToCart(service.id, patna.id, 1);
      const items = p.body.data.items as { cityId: string; finalUnitPrice: number; mrp: number; unitPriceAtAdd: number; priceChanged: boolean; lineTotal: number }[];
      const ranchiItem = items.find((i) => i.cityId === ranchi.id)!;
      const patnaItem = items.find((i) => i.cityId === patna.id)!;
      expect([ranchiItem.unitPriceAtAdd, ranchiItem.finalUnitPrice, ranchiItem.mrp, ranchiItem.lineTotal, ranchiItem.priceChanged]).toEqual([700, 700, 800, 1400, false]);
      expect([patnaItem.unitPriceAtAdd, patnaItem.finalUnitPrice, patnaItem.mrp]).toEqual([600, 600, 710]);
      expect(p.body.data.subtotal).toBe(2000);
    });

    it("reflects a price changed after adding to the cart (cart flags it, order uses the live price)", async () => {
      const { service, ranchi } = await fixture();
      await setPricing(service.id, [{ cityId: ranchi.id, mrp: 800, offerPrice: 700 }]);
      await addToCart(service.id, ranchi.id, 1);
      await setPricing(service.id, [{ cityId: ranchi.id, mrp: 900, offerPrice: 750 }]);
      const cart = await testAgent().get("/api/v1/customer/cart").set("Authorization", bearer(customerToken));
      expect([cart.body.data.items[0].unitPriceAtAdd, cart.body.data.items[0].finalUnitPrice, cart.body.data.items[0].priceChanged]).toEqual([700, 750, true]);
      const order = await testAgent().post("/api/v1/customer/orders").set("Authorization", bearer(customerToken))
        .send({ addressId: await address(), scheduledDate: "2026-12-01", idempotencyKey: randomUUID() });
      expect(order.status).toBe(201);
      expect([order.body.data.subtotal, order.body.data.total]).toEqual([900, 750]);
    });

    it("creates the order from the server-resolved city price (snapshots included), ignoring client-sent prices", async () => {
      const { service, ranchi, mumbai } = await fixture();
      await setPricing(service.id, [{ cityId: ranchi.id, mrp: 800, offerPrice: 700 }, { cityId: mumbai.id, mrp: 900, offerPrice: 800 }]);
      await addToCart(service.id, ranchi.id, 2);
      await addToCart(service.id, mumbai.id, 1);
      const res = await testAgent().post("/api/v1/customer/orders").set("Authorization", bearer(customerToken))
        .send({ addressId: await address(), scheduledDate: "2026-12-01", idempotencyKey: randomUUID(), total: 1, unitPrice: 1, items: [{ unitPrice: 1 }] });
      expect(res.status).toBe(201);
      expect(res.body.data.subtotal).toBe(800 * 2 + 900);
      expect(res.body.data.total).toBe(700 * 2 + 800);
      expect(res.body.data.discountTotal).toBe(100 * 2 + 100);
      const prices = (res.body.data.items as { unitPrice: number; mrp: number; quantity: number }[]).map((i) => [i.quantity, i.mrp, i.unitPrice]).sort();
      expect(prices).toEqual([[1, 900, 800], [2, 800, 700]]);
    });

    it("uses base prices for a city without custom pricing, and still blocks an unavailable city", async () => {
      const { service, patna } = await fixture();
      await addToCart(service.id, patna.id, 1);
      const order = await testAgent().post("/api/v1/customer/orders").set("Authorization", bearer(customerToken))
        .send({ addressId: await address(), scheduledDate: "2026-12-01", idempotencyKey: randomUUID() });
      expect([order.body.data.subtotal, order.body.data.total]).toEqual([710, 600]);

      await addToCart(service.id, patna.id, 1);
      await setAvailability(service.id, [{ cityId: patna.id, active: false }]);
      const blocked = await testAgent().post("/api/v1/customer/orders").set("Authorization", bearer(customerToken))
        .send({ addressId: await address(), scheduledDate: "2026-12-01", idempotencyKey: randomUUID() });
      expect(blocked.status).toBe(409);
    });

    it("merges a local cart using the item's city price", async () => {
      const { service, ranchi } = await fixture();
      await setPricing(service.id, [{ cityId: ranchi.id, mrp: 800, offerPrice: 700 }]);
      const res = await testAgent().post("/api/v1/customer/cart/merge").set("Authorization", bearer(customerToken))
        .send({ items: [{ serviceId: service.id, cityId: ranchi.id, quantity: 3 }] });
      expect(res.status).toBe(200);
      expect(res.body.data.items[0].unitPriceAtAdd).toBe(700);
      expect(res.body.data.subtotal).toBe(2100);
    });
  });
});
