import { randomUUID } from "node:crypto";
import { testAgent } from "../helpers/testApp";
import { resetDatabase } from "../helpers/db";
import { bearer, mintToken } from "../helpers/cognitoTestKit";
import { seedCatalogBasics, seedOffer, seedService } from "../helpers/factories";
import { setServiceCityAvailability } from "../../src/modules/availability/availability.service";

/**
 * PHASE 3 CORRECTION — Offer applicability (ALL_INDIA vs. CITY), priority
 * (CITY beats ALL_INDIA, never stacked), and the now-combined
 * service-discount + effective-offer pricing pipeline. See
 * PHASE_3_BACKEND_IMPLEMENTATION.md's offer-correction section and
 * shared/pricing.ts's `computeFinalPricing` for the authoritative design.
 */
describe("offer applicability schema validation", () => {
  const adminToken = mintToken({ role: "admin" });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("allows an ALL_INDIA offer with cityId omitted", async () => {
    const res = await testAgent().post("/api/v1/admin/offers").set("Authorization", bearer(adminToken)).send({
      title: "All India Offer",
      description: "x",
      discountType: "percent",
      discountValue: 10,
      applicabilityType: "all_india",
      appliesTo: { scope: "all", ids: [] },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.applicabilityType).toBe("all_india");
    expect(res.body.data.cityId).toBeNull();
  });

  it("requires a cityId for a CITY offer", async () => {
    const res = await testAgent().post("/api/v1/admin/offers").set("Authorization", bearer(adminToken)).send({
      title: "City Offer",
      description: "x",
      discountType: "flat",
      discountValue: 100,
      applicabilityType: "city",
      appliesTo: { scope: "all", ids: [] },
    });
    expect(res.status).toBe(400);
  });

  it("rejects an ALL_INDIA offer that also specifies a cityId", async () => {
    const { city } = await seedCatalogBasics();
    const res = await testAgent().post("/api/v1/admin/offers").set("Authorization", bearer(adminToken)).send({
      title: "Bad Offer",
      description: "x",
      discountType: "flat",
      discountValue: 100,
      applicabilityType: "all_india",
      cityId: city.id,
      appliesTo: { scope: "all", ids: [] },
    });
    expect(res.status).toBe(400);
  });

  it("accepts a CITY offer with a valid cityId", async () => {
    const { city } = await seedCatalogBasics();
    const res = await testAgent().post("/api/v1/admin/offers").set("Authorization", bearer(adminToken)).send({
      title: "City Offer",
      description: "x",
      discountType: "flat",
      discountValue: 500,
      applicabilityType: "city",
      cityId: city.id,
      appliesTo: { scope: "all", ids: [] },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.applicabilityType).toBe("city");
    expect(res.body.data.cityId).toBe(city.id);
  });

  it("rejects a cityId that does not reference an existing city", async () => {
    const res = await testAgent().post("/api/v1/admin/offers").set("Authorization", bearer(adminToken)).send({
      title: "Bad City",
      description: "x",
      discountType: "flat",
      discountValue: 100,
      applicabilityType: "city",
      cityId: randomUUID(),
      appliesTo: { scope: "all", ids: [] },
    });
    expect(res.status).toBe(400);
  });

  it("rejects a percent discount over 100", async () => {
    const res = await testAgent().post("/api/v1/admin/offers").set("Authorization", bearer(adminToken)).send({
      title: "Too much",
      description: "x",
      discountType: "percent",
      discountValue: 150,
      applicabilityType: "all_india",
      appliesTo: { scope: "all", ids: [] },
    });
    expect(res.status).toBe(400);
  });

  it("rejects an end date before the start date", async () => {
    const res = await testAgent().post("/api/v1/admin/offers").set("Authorization", bearer(adminToken)).send({
      title: "Bad dates",
      description: "x",
      discountType: "flat",
      discountValue: 10,
      applicabilityType: "all_india",
      appliesTo: { scope: "all", ids: [] },
      startDate: "2026-06-01",
      endDate: "2026-01-01",
    });
    expect(res.status).toBe(400);
  });

  it("rejects an offer scoped to a service id that does not exist", async () => {
    const res = await testAgent().post("/api/v1/admin/offers").set("Authorization", bearer(adminToken)).send({
      title: "Ghost service",
      description: "x",
      discountType: "flat",
      discountValue: 10,
      applicabilityType: "all_india",
      appliesTo: { scope: "service", ids: [randomUUID()] },
    });
    expect(res.status).toBe(400);
  });

  it("rejects switching an existing CITY offer to ALL_INDIA while a cityId is still present in the same request", async () => {
    const { city } = await seedCatalogBasics();
    const create = await testAgent().post("/api/v1/admin/offers").set("Authorization", bearer(adminToken)).send({
      title: "City Offer",
      description: "x",
      discountType: "flat",
      discountValue: 500,
      applicabilityType: "city",
      cityId: city.id,
      appliesTo: { scope: "all", ids: [] },
    });
    const res = await testAgent()
      .patch(`/api/v1/admin/offers/${create.body.data.id}`)
      .set("Authorization", bearer(adminToken))
      .send({ applicabilityType: "all_india", cityId: city.id });
    expect(res.status).toBe(400);
  });

  it("allows switching an existing CITY offer to ALL_INDIA by also clearing cityId", async () => {
    const { city } = await seedCatalogBasics();
    const create = await testAgent().post("/api/v1/admin/offers").set("Authorization", bearer(adminToken)).send({
      title: "City Offer",
      description: "x",
      discountType: "flat",
      discountValue: 500,
      applicabilityType: "city",
      cityId: city.id,
      appliesTo: { scope: "all", ids: [] },
    });
    const res = await testAgent()
      .patch(`/api/v1/admin/offers/${create.body.data.id}`)
      .set("Authorization", bearer(adminToken))
      .send({ applicabilityType: "all_india", cityId: null });
    expect(res.status).toBe(200);
    expect(res.body.data.applicabilityType).toBe("all_india");
    expect(res.body.data.cityId).toBeNull();
  });

  it("Admin can read a single offer and list all offers regardless of city", async () => {
    const { city } = await seedCatalogBasics();
    const otherCityBundle = await seedCatalogBasics();
    await seedOffer({ applicabilityType: "city", cityId: city.id, title: "City A Offer" });
    await seedOffer({ applicabilityType: "city", cityId: otherCityBundle.city.id, title: "City B Offer" });
    await seedOffer({ applicabilityType: "all_india", cityId: null, title: "National Offer" });

    const listRes = await testAgent().get("/api/v1/admin/offers").set("Authorization", bearer(adminToken));
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(3);

    const oneRes = await testAgent()
      .get(`/api/v1/admin/offers/${listRes.body.data[0].id}`)
      .set("Authorization", bearer(adminToken));
    expect(oneRes.status).toBe(200);
  });
});

describe("offer applicability resolution", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("an ALL_INDIA offer applies in every city the service is available in", async () => {
    const ranchi = await seedCatalogBasics();
    const delhi = await seedCatalogBasics();
    const mumbai = await seedCatalogBasics();
    const service = await seedService({ productId: ranchi.product.id, serviceTypeId: ranchi.serviceType.id, approve: true });
    await setServiceCityAvailability(service.id, [
      { cityId: ranchi.city.id, active: true },
      { cityId: delhi.city.id, active: true },
      { cityId: mumbai.city.id, active: true },
    ]);
    await seedOffer({ applicabilityType: "all_india", discountType: "percent", discountValue: 10 });

    for (const city of [ranchi.city, delhi.city, mumbai.city]) {
      const res = await testAgent().get(`/api/v1/services/${service.slug}?cityId=${city.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.effectiveOffer?.applicabilityType).toBe("all_india");
    }
  });

  it("a CITY offer applies only in its own city, never another", async () => {
    const ranchi = await seedCatalogBasics();
    const delhi = await seedCatalogBasics();
    const service = await seedService({ productId: ranchi.product.id, serviceTypeId: ranchi.serviceType.id, approve: true });
    await setServiceCityAvailability(service.id, [
      { cityId: ranchi.city.id, active: true },
      { cityId: delhi.city.id, active: true },
    ]);
    await seedOffer({ applicabilityType: "city", cityId: ranchi.city.id, discountType: "flat", discountValue: 500 });

    const inRanchi = await testAgent().get(`/api/v1/services/${service.slug}?cityId=${ranchi.city.id}`);
    expect(inRanchi.body.data.effectiveOffer?.applicabilityType).toBe("city");
    expect(inRanchi.body.data.effectiveOffer?.cityId).toBe(ranchi.city.id);

    const inDelhi = await testAgent().get(`/api/v1/services/${service.slug}?cityId=${delhi.city.id}`);
    expect(inDelhi.body.data.effectiveOffer).toBeNull();
  });

  it("the public offers endpoint never returns one city's CITY offer for a different city's context", async () => {
    const ranchi = await seedCatalogBasics();
    const delhi = await seedCatalogBasics();
    await seedOffer({ applicabilityType: "city", cityId: ranchi.city.id, title: "Ranchi Special" });
    await seedOffer({ applicabilityType: "city", cityId: delhi.city.id, title: "Delhi Festival" });

    const forRanchi = await testAgent().get(`/api/v1/offers?cityId=${ranchi.city.id}`);
    const titles = forRanchi.body.data.map((o: { title: string }) => o.title);
    expect(titles).toContain("Ranchi Special");
    expect(titles).not.toContain("Delhi Festival");

    const forDelhi = await testAgent().get(`/api/v1/offers?cityId=${delhi.city.id}`);
    const delhiTitles = forDelhi.body.data.map((o: { title: string }) => o.title);
    expect(delhiTitles).toContain("Delhi Festival");
    expect(delhiTitles).not.toContain("Ranchi Special");
  });
});

describe("offer priority (CITY beats ALL_INDIA, never stacked)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("the multi-city scenario from the correction brief: Ranchi/Delhi get their own offer, a third city falls back to ALL_INDIA", async () => {
    const ranchi = await seedCatalogBasics();
    const delhi = await seedCatalogBasics();
    const mumbai = await seedCatalogBasics();
    const service = await seedService({
      productId: ranchi.product.id,
      serviceTypeId: ranchi.serviceType.id,
      mrp: 10000,
      offerPrice: 9000,
      approve: true,
    });
    await setServiceCityAvailability(service.id, [
      { cityId: ranchi.city.id, active: true },
      { cityId: delhi.city.id, active: true },
      { cityId: mumbai.city.id, active: true },
    ]);

    await seedOffer({ applicabilityType: "all_india", discountType: "percent", discountValue: 10 });
    await seedOffer({ applicabilityType: "city", cityId: ranchi.city.id, discountType: "flat", discountValue: 500 });
    await seedOffer({ applicabilityType: "city", cityId: delhi.city.id, discountType: "flat", discountValue: 300 });

    const inRanchi = await testAgent().get(`/api/v1/services/${service.slug}?cityId=${ranchi.city.id}`);
    expect(inRanchi.body.data.offerDiscountAmount).toBe(500);
    expect(inRanchi.body.data.finalPrice).toBe(8500);

    const inDelhi = await testAgent().get(`/api/v1/services/${service.slug}?cityId=${delhi.city.id}`);
    expect(inDelhi.body.data.offerDiscountAmount).toBe(300);
    expect(inDelhi.body.data.finalPrice).toBe(8700);

    const inMumbai = await testAgent().get(`/api/v1/services/${service.slug}?cityId=${mumbai.city.id}`);
    expect(inMumbai.body.data.effectiveOffer?.applicabilityType).toBe("all_india");
    expect(inMumbai.body.data.offerDiscountAmount).toBe(900); // 10% of 9000
    expect(inMumbai.body.data.finalPrice).toBe(8100);
  });

  it("never stacks multiple matching offers — only the single effective offer's discount is applied", async () => {
    const bundle = await seedCatalogBasics();
    const service = await seedService({
      productId: bundle.product.id,
      serviceTypeId: bundle.serviceType.id,
      cityId: bundle.city.id,
      mrp: 10000,
      offerPrice: 9000,
      approve: true,
    });
    await seedOffer({ applicabilityType: "all_india", discountType: "percent", discountValue: 10 });
    await seedOffer({ applicabilityType: "city", cityId: bundle.city.id, discountType: "flat", discountValue: 500 });

    const res = await testAgent().get(`/api/v1/services/${service.slug}?cityId=${bundle.city.id}`);
    // Only the city offer (500 flat) applies — NOT 500 + 900.
    expect(res.body.data.offerDiscountAmount).toBe(500);
    expect(res.body.data.totalDiscountAmount).toBe(1500); // 1000 service discount + 500 offer discount
  });

  it("resolves multiple ambiguous CITY offers for the same city deterministically (most recently created wins) rather than stacking", async () => {
    const bundle = await seedCatalogBasics();
    const service = await seedService({
      productId: bundle.product.id,
      serviceTypeId: bundle.serviceType.id,
      cityId: bundle.city.id,
      mrp: 1000,
      offerPrice: 900,
      approve: true,
    });
    await seedOffer({ applicabilityType: "city", cityId: bundle.city.id, discountType: "flat", discountValue: 50, title: "Older" });
    const newer = await seedOffer({
      applicabilityType: "city",
      cityId: bundle.city.id,
      discountType: "flat",
      discountValue: 80,
      title: "Newer",
    });

    const res = await testAgent().get(`/api/v1/services/${service.slug}?cityId=${bundle.city.id}`);
    expect(res.body.data.effectiveOffer?.id).toBe(newer.id);
    expect(res.body.data.offerDiscountAmount).toBe(80);
  });
});

describe("combined service discount + offer discount pricing math", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("computes a flat offer correctly on top of the service's own discount", async () => {
    const bundle = await seedCatalogBasics();
    const service = await seedService({
      productId: bundle.product.id,
      serviceTypeId: bundle.serviceType.id,
      cityId: bundle.city.id,
      mrp: 10000,
      offerPrice: 9000,
      approve: true,
    });
    await seedOffer({ applicabilityType: "city", cityId: bundle.city.id, discountType: "flat", discountValue: 500 });

    const res = await testAgent().get(`/api/v1/services/${service.slug}?cityId=${bundle.city.id}`);
    expect(res.body.data.mrp).toBe(10000);
    expect(res.body.data.offerPrice).toBe(9000);
    expect(res.body.data.discountAmount).toBe(1000);
    expect(res.body.data.offerDiscountAmount).toBe(500);
    expect(res.body.data.totalDiscountAmount).toBe(1500);
    expect(res.body.data.finalPrice).toBe(8500);
  });

  it("computes a percentage offer against the service's OFFER PRICE, never the raw mrp", async () => {
    const bundle = await seedCatalogBasics();
    const service = await seedService({
      productId: bundle.product.id,
      serviceTypeId: bundle.serviceType.id,
      cityId: bundle.city.id,
      mrp: 10000,
      offerPrice: 9000,
      approve: true,
    });
    await seedOffer({ applicabilityType: "all_india", discountType: "percent", discountValue: 10 });

    const res = await testAgent().get(`/api/v1/services/${service.slug}?cityId=${bundle.city.id}`);
    // 10% of 9000 = 900, NOT 10% of 10000 = 1000.
    expect(res.body.data.offerDiscountAmount).toBe(900);
    expect(res.body.data.finalPrice).toBe(8100);
    expect(res.body.data.totalDiscountAmount).toBe(1900);
  });

  it("never lets the final price go negative — a discount larger than the base consumes the whole base", async () => {
    const bundle = await seedCatalogBasics();
    const service = await seedService({
      productId: bundle.product.id,
      serviceTypeId: bundle.serviceType.id,
      cityId: bundle.city.id,
      mrp: 600,
      offerPrice: 500,
      approve: true,
    });
    await seedOffer({ applicabilityType: "city", cityId: bundle.city.id, discountType: "flat", discountValue: 700 });

    const res = await testAgent().get(`/api/v1/services/${service.slug}?cityId=${bundle.city.id}`);
    expect(res.body.data.finalPrice).toBe(0);
    expect(res.body.data.finalPrice).toBeGreaterThanOrEqual(0);
  });

  it("ignores an inactive offer", async () => {
    const bundle = await seedCatalogBasics();
    const service = await seedService({
      productId: bundle.product.id,
      serviceTypeId: bundle.serviceType.id,
      cityId: bundle.city.id,
      offerPrice: 900,
      approve: true,
    });
    await seedOffer({ applicabilityType: "city", cityId: bundle.city.id, discountType: "flat", discountValue: 100, active: false });

    const res = await testAgent().get(`/api/v1/services/${service.slug}?cityId=${bundle.city.id}`);
    expect(res.body.data.effectiveOffer).toBeNull();
    expect(res.body.data.finalPrice).toBe(900);
  });

  it("ignores an offer outside its start/end date range", async () => {
    const bundle = await seedCatalogBasics();
    const service = await seedService({
      productId: bundle.product.id,
      serviceTypeId: bundle.serviceType.id,
      cityId: bundle.city.id,
      offerPrice: 900,
      approve: true,
    });
    await seedOffer({
      applicabilityType: "city",
      cityId: bundle.city.id,
      discountType: "flat",
      discountValue: 100,
      startDate: "2000-01-01",
      endDate: "2000-12-31",
    });

    const res = await testAgent().get(`/api/v1/services/${service.slug}?cityId=${bundle.city.id}`);
    expect(res.body.data.effectiveOffer).toBeNull();
  });

  it("respects service/category scope — an offer scoped to a different service never applies", async () => {
    const bundle = await seedCatalogBasics();
    const service = await seedService({
      productId: bundle.product.id,
      serviceTypeId: bundle.serviceType.id,
      cityId: bundle.city.id,
      offerPrice: 900,
      approve: true,
    });
    const otherService = await seedService({
      productId: bundle.product.id,
      serviceTypeId: bundle.serviceType.id,
      cityId: bundle.city.id,
      approve: true,
    });
    await seedOffer({
      applicabilityType: "city",
      cityId: bundle.city.id,
      appliesTo: { scope: "service", ids: [otherService.id] },
    });

    const res = await testAgent().get(`/api/v1/services/${service.slug}?cityId=${bundle.city.id}`);
    expect(res.body.data.effectiveOffer).toBeNull();
  });

  it("a service unavailable in the selected city cannot use that city's offer", async () => {
    const bundle = await seedCatalogBasics();
    const otherCity = await seedCatalogBasics();
    const service = await seedService({
      productId: bundle.product.id,
      serviceTypeId: bundle.serviceType.id,
      cityId: bundle.city.id, // only available in bundle.city, not otherCity.city
      approve: true,
    });
    await seedOffer({ applicabilityType: "city", cityId: otherCity.city.id, discountType: "flat", discountValue: 100 });

    const res = await testAgent().get(`/api/v1/services/${service.slug}?cityId=${otherCity.city.id}`);
    expect(res.status).toBe(404); // not available in that city at all
  });
});

describe("order pricing with offers — server-authoritative, snapshotted, tamper-proof", () => {
  const customerToken = mintToken({ role: "customer", sub: "fffffff1-ffff-4fff-8fff-fffffffffff1" });
  const adminToken = mintToken({ role: "admin" });

  beforeEach(async () => {
    await resetDatabase();
  });

  async function addressFor(token: string) {
    const res = await testAgent()
      .post("/api/v1/customer/addresses")
      .set("Authorization", bearer(token))
      .send({ label: "Home", line1: "221B Test Lane", city: "Testville", state: "TS", pincode: "560001" });
    return res.body.data.id as string;
  }

  it("snapshots the effective offer and combined discount onto the created order", async () => {
    const bundle = await seedCatalogBasics();
    const service = await seedService({
      productId: bundle.product.id,
      serviceTypeId: bundle.serviceType.id,
      cityId: bundle.city.id,
      mrp: 10000,
      offerPrice: 9000,
      approve: true,
    });
    const offer = await seedOffer({ applicabilityType: "city", cityId: bundle.city.id, discountType: "flat", discountValue: 500 });

    await testAgent()
      .post("/api/v1/customer/cart/items")
      .set("Authorization", bearer(customerToken))
      .send({ serviceId: service.id, cityId: bundle.city.id, quantity: 1 });
    const addressId = await addressFor(customerToken);

    const res = await testAgent()
      .post("/api/v1/customer/orders")
      .set("Authorization", bearer(customerToken))
      .send({ addressId, scheduledDate: "2026-12-01", idempotencyKey: randomUUID() });

    expect(res.status).toBe(201);
    expect(res.body.data.subtotal).toBe(10000);
    expect(res.body.data.discountTotal).toBe(1500); // 1000 service + 500 offer
    expect(res.body.data.total).toBe(8500);

    const item = res.body.data.items[0];
    expect(item.mrp).toBe(10000);
    expect(item.serviceOfferPrice).toBe(9000);
    expect(item.serviceDiscountAmount).toBe(1000);
    expect(item.effectiveOffer.id).toBe(offer.id);
    expect(item.effectiveOffer.applicabilityType).toBe("city");
    expect(item.offerDiscountAmount).toBe(500);
    expect(item.totalDiscountAmount).toBe(1500);
    expect(item.unitPrice).toBe(8500);
    expect(item.lineTotal).toBe(8500);
  });

  it("recalculates pricing from the database at order time rather than trusting the cart's own display pricing", async () => {
    const bundle = await seedCatalogBasics();
    const service = await seedService({
      productId: bundle.product.id,
      serviceTypeId: bundle.serviceType.id,
      cityId: bundle.city.id,
      mrp: 1000,
      offerPrice: 900,
      approve: true,
    });
    await testAgent()
      .post("/api/v1/customer/cart/items")
      .set("Authorization", bearer(customerToken))
      .send({ serviceId: service.id, cityId: bundle.city.id, quantity: 1 });

    // Cart shows no offer yet.
    const cartBefore = await testAgent().get("/api/v1/customer/cart").set("Authorization", bearer(customerToken));
    expect(cartBefore.body.data.items[0].effectiveOffer).toBeNull();

    // An offer appears AFTER the item was added to the cart.
    await seedOffer({ applicabilityType: "city", cityId: bundle.city.id, discountType: "flat", discountValue: 100 });

    const cartAfter = await testAgent().get("/api/v1/customer/cart").set("Authorization", bearer(customerToken));
    expect(cartAfter.body.data.items[0].effectiveOffer).not.toBeNull();
    expect(cartAfter.body.data.items[0].finalUnitPrice).toBe(800);

    const addressId = await addressFor(customerToken);
    const res = await testAgent()
      .post("/api/v1/customer/orders")
      .set("Authorization", bearer(customerToken))
      .send({ addressId, scheduledDate: "2026-12-01", idempotencyKey: randomUUID() });

    // The order uses the offer that is valid NOW, at order-creation time.
    expect(res.body.data.total).toBe(800);
  });

  it("ignores any client-submitted discount/offer fields on order creation", async () => {
    const bundle = await seedCatalogBasics();
    const service = await seedService({
      productId: bundle.product.id,
      serviceTypeId: bundle.serviceType.id,
      cityId: bundle.city.id,
      mrp: 1000,
      offerPrice: 900,
      approve: true,
    });
    await testAgent()
      .post("/api/v1/customer/cart/items")
      .set("Authorization", bearer(customerToken))
      .send({ serviceId: service.id, cityId: bundle.city.id, quantity: 1 });
    const addressId = await addressFor(customerToken);

    const res = await testAgent()
      .post("/api/v1/customer/orders")
      .set("Authorization", bearer(customerToken))
      .send({
        addressId,
        scheduledDate: "2026-12-01",
        idempotencyKey: randomUUID(),
        offerDiscountAmount: 99999,
        totalDiscountAmount: 99999,
        total: 1,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.total).toBe(900); // untouched by the injected fields — no offer exists at all here
  });

  it("keeps a historical order's pricing unchanged after the service price and the offer are both later modified", async () => {
    const bundle = await seedCatalogBasics();
    const service = await seedService({
      productId: bundle.product.id,
      serviceTypeId: bundle.serviceType.id,
      cityId: bundle.city.id,
      mrp: 10000,
      offerPrice: 9000,
      approve: true,
    });
    const offer = await seedOffer({ applicabilityType: "city", cityId: bundle.city.id, discountType: "flat", discountValue: 500 });

    await testAgent()
      .post("/api/v1/customer/cart/items")
      .set("Authorization", bearer(customerToken))
      .send({ serviceId: service.id, cityId: bundle.city.id, quantity: 1 });
    const addressId = await addressFor(customerToken);
    const createRes = await testAgent()
      .post("/api/v1/customer/orders")
      .set("Authorization", bearer(customerToken))
      .send({ addressId, scheduledDate: "2026-12-01", idempotencyKey: randomUUID() });
    expect(createRes.body.data.total).toBe(8500);

    // Admin changes the service's price AND the offer's discount after the order was placed.
    await testAgent()
      .patch(`/api/v1/admin/services/${service.id}`)
      .set("Authorization", bearer(adminToken))
      .send({ offerPrice: 1 });
    await testAgent()
      .patch(`/api/v1/admin/offers/${offer.id}`)
      .set("Authorization", bearer(adminToken))
      .send({ discountValue: 99999 });

    const reread = await testAgent()
      .get(`/api/v1/customer/orders/${createRes.body.data.id}`)
      .set("Authorization", bearer(customerToken));
    expect(reread.body.data.total).toBe(8500);
    expect(reread.body.data.items[0].unitPrice).toBe(8500);
    expect(reread.body.data.items[0].effectiveOffer.name).toBe(offer.title);
  });
});
