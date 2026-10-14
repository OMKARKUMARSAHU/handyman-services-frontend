import { randomUUID } from "node:crypto";
import { testAgent } from "../helpers/testApp";
import { bearer, mintToken } from "../helpers/cognitoTestKit";
import { resetDatabase } from "../helpers/db";
import { getDb } from "../../src/database/db";
import { seedCustomerWithAddress, seedShopCategory, seedShopCity, seedShopProduct } from "../helpers/shopFactories";
import { effectivePrice } from "../../src/modules/shop/shopCity.service";

/**
 * City-wise availability and pricing: a product with no city rows is sold
 * everywhere at its base price; an admin can hide it per city, set a per-city
 * price, or apply a percentage adjustment per city. The server enforces all of
 * it at pricing AND at order time — the browser only names a city.
 */
describe("shop: city-wise availability and pricing", () => {
  const adminToken = mintToken({ role: "admin" });
  const admin = (r: ReturnType<ReturnType<typeof testAgent>["get"]>) => r.set("Authorization", bearer(adminToken));

  beforeEach(async () => {
    await resetDatabase();
  });

  describe("effectivePrice (pure)", () => {
    it("uses an explicit override, otherwise base adjusted by the city percentage", () => {
      expect(effectivePrice(1000, { priceOverride: 900 }, 10)).toBe(900);
      expect(effectivePrice(1000, undefined, 10)).toBe(1100);
      expect(effectivePrice(1000, { priceOverride: null }, -5)).toBe(950);
      expect(effectivePrice(199.99, undefined, 0)).toBe(199.99);
    });
  });

  it("without any city rows a product is available everywhere at the base price", async () => {
    const city = await seedShopCity("Ranchi");
    const cat = await seedShopCategory();
    const p = await seedShopProduct(cat.id, { price: 1000 });
    const list = await testAgent().get(`/api/v1/shop/products?city=${city.slug}`);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ price: 1000, availableInCity: true });
    const detail = await testAgent().get(`/api/v1/shop/products/${p.slug}?city=${city.slug}`);
    expect(detail.body.data.product).toMatchObject({ price: 1000, availableInCity: true });
  });

  it("rejects an unknown city slug", async () => {
    const res = await testAgent().get("/api/v1/shop/products?city=atlantis");
    expect(res.status).toBe(400);
  });

  describe("admin configuration", () => {
    it("requires an admin and validates input", async () => {
      const city = await seedShopCity();
      const cat = await seedShopCategory();
      const p = await seedShopProduct(cat.id);
      const url = `/api/v1/admin/shop/products/${p.id}/cities`;
      expect((await testAgent().get(url)).status).toBe(401);
      expect((await testAgent().get(url).set("Authorization", bearer(mintToken({ role: "customer" })))).status).toBe(403);
      const put = (cities: unknown) => testAgent().put(url).set("Authorization", bearer(adminToken)).send({ cities });
      expect((await put([{ cityId: city.id, available: true, priceOverride: -5 }])).status).toBe(400);
      expect((await put([{ cityId: city.id, available: true, priceOverride: 10.555 }])).status).toBe(400);
      expect((await put([{ cityId: randomUUID(), available: true }])).status).toBe(400);
      expect((await put([{ cityId: city.id, available: true }, { cityId: city.id, available: false }])).status).toBe(400);
      const pricing = (cities: unknown) => testAgent().put("/api/v1/admin/shop/city-pricing").set("Authorization", bearer(adminToken)).send({ cities });
      expect((await pricing([{ cityId: city.id, productPriceAdjustPercent: -95 }])).status).toBe(400);
      expect((await testAgent().put("/api/v1/admin/shop/city-pricing").send({ cities: [] })).status).toBe(401);
    });

    it("lists cities with their availability, override and effective price", async () => {
      const a = await seedShopCity("Alpha");
      const b = await seedShopCity("Beta");
      const cat = await seedShopCategory();
      const p = await seedShopProduct(cat.id, { price: 1000 });
      await testAgent().put("/api/v1/admin/shop/city-pricing").set("Authorization", bearer(adminToken)).send({ cities: [{ cityId: a.id, productPriceAdjustPercent: 10 }] });
      await testAgent().put(`/api/v1/admin/shop/products/${p.id}/cities`).set("Authorization", bearer(adminToken)).send({ cities: [{ cityId: b.id, available: false }] });
      const res = await admin(testAgent().get(`/api/v1/admin/shop/products/${p.id}/cities`));
      const rows = res.body.data as Array<{ slug: string; available: boolean; effectivePrice: number; priceOverride: number | null }>;
      expect(rows.find((r) => r.slug === a.slug)).toMatchObject({ available: true, effectivePrice: 1100, priceOverride: null });
      expect(rows.find((r) => r.slug === b.slug)).toMatchObject({ available: false });
    });

    it("stores only exceptions: available with no override removes the row", async () => {
      const c = await seedShopCity();
      const cat = await seedShopCategory();
      const p = await seedShopProduct(cat.id);
      const put = (row: object) => testAgent().put(`/api/v1/admin/shop/products/${p.id}/cities`).set("Authorization", bearer(adminToken)).send({ cities: [row] });
      await put({ cityId: c.id, available: false });
      expect(Number((await getDb()("shop_product_cities").count({ n: "id" }).first())?.n)).toBe(1);
      await put({ cityId: c.id, available: true });
      expect(Number((await getDb()("shop_product_cities").count({ n: "id" }).first())?.n)).toBe(0);
    });
  });

  describe("storefront", () => {
    it("hides a product in a city where it is unavailable, still shows it elsewhere", async () => {
      const a = await seedShopCity("Alpha");
      const b = await seedShopCity("Beta");
      const cat = await seedShopCategory();
      const p = await seedShopProduct(cat.id);
      await testAgent().put(`/api/v1/admin/shop/products/${p.id}/cities`).set("Authorization", bearer(adminToken)).send({ cities: [{ cityId: b.id, available: false }] });
      expect((await testAgent().get(`/api/v1/shop/products?city=${a.slug}`)).body.data).toHaveLength(1);
      expect((await testAgent().get(`/api/v1/shop/products?city=${b.slug}`)).body.data).toHaveLength(0);
      expect((await testAgent().get("/api/v1/shop/products")).body.data).toHaveLength(1);
      const detail = await testAgent().get(`/api/v1/shop/products/${p.slug}?city=${b.slug}`);
      expect(detail.status).toBe(200);
      expect(detail.body.data.product.availableInCity).toBe(false);
    });

    it("applies city prices (override beats the city percentage) and sorts by them", async () => {
      const a = await seedShopCity("Alpha");
      const cat = await seedShopCategory();
      const cheapBase = await seedShopProduct(cat.id, { price: 100 });
      const dearBase = await seedShopProduct(cat.id, { price: 150 });
      await testAgent().put("/api/v1/admin/shop/city-pricing").set("Authorization", bearer(adminToken)).send({ cities: [{ cityId: a.id, productPriceAdjustPercent: 100 }] });
      // cheapBase becomes 200 via the percentage; dearBase is overridden down to 120.
      await testAgent().put(`/api/v1/admin/shop/products/${dearBase.id}/cities`).set("Authorization", bearer(adminToken)).send({ cities: [{ cityId: a.id, available: true, priceOverride: 120 }] });
      const asc = await testAgent().get(`/api/v1/shop/products?city=${a.slug}&sort=price_asc`);
      expect(asc.body.data.map((x: { price: number; id: string }) => [x.id, x.price])).toEqual([
        [dearBase.id, 120],
        [cheapBase.id, 200],
      ]);
      const noCity = await testAgent().get("/api/v1/shop/products?sort=price_asc");
      expect(noCity.body.data.map((x: { price: number }) => x.price)).toEqual([100, 150]);
    });

    it("discount percent is computed from the city price", async () => {
      const a = await seedShopCity("Alpha");
      const cat = await seedShopCategory();
      const p = await seedShopProduct(cat.id, { price: 800, mrp: 1000 });
      await testAgent().put(`/api/v1/admin/shop/products/${p.id}/cities`).set("Authorization", bearer(adminToken)).send({ cities: [{ cityId: a.id, available: true, priceOverride: 900 }] });
      const res = await testAgent().get(`/api/v1/shop/products?city=${a.slug}`);
      expect(res.body.data[0]).toMatchObject({ price: 900, mrp: 1000, discountPercent: 10 });
    });
  });

  describe("cart and order enforcement", () => {
    it("prices the cart in the chosen city and blocks checkout without a city", async () => {
      const a = await seedShopCity("Alpha");
      const cat = await seedShopCategory();
      const p = await seedShopProduct(cat.id, { price: 1000 });
      await testAgent().put("/api/v1/admin/shop/city-pricing").set("Authorization", bearer(adminToken)).send({ cities: [{ cityId: a.id, productPriceAdjustPercent: 10 }] });
      const withCity = await testAgent().post("/api/v1/shop/cart/price").send({ items: [{ productId: p.id, quantity: 2 }], city: a.slug });
      expect(withCity.body.data).toMatchObject({ subtotal: 2200, canCheckout: true, cityRequired: false });
      const without = await testAgent().post("/api/v1/shop/cart/price").send({ items: [{ productId: p.id, quantity: 2 }] });
      expect(without.body.data).toMatchObject({ subtotal: 2000, canCheckout: false, cityRequired: true });
    });

    it("flags a line that is unavailable in the city and blocks checkout", async () => {
      const a = await seedShopCity("Alpha");
      const cat = await seedShopCategory();
      const p = await seedShopProduct(cat.id);
      await testAgent().put(`/api/v1/admin/shop/products/${p.id}/cities`).set("Authorization", bearer(adminToken)).send({ cities: [{ cityId: a.id, available: false }] });
      const res = await testAgent().post("/api/v1/shop/cart/price").send({ items: [{ productId: p.id, quantity: 1 }], city: a.slug });
      expect(res.body.data.lines[0]).toMatchObject({ available: false, issue: "Not available in Alpha." });
      expect(res.body.data.canCheckout).toBe(false);
    });

    it("order creation requires a city, charges the CITY price and rejects an unavailable product (no stock taken)", async () => {
      const a = await seedShopCity("Alpha");
      const b = await seedShopCity("Beta");
      const cat = await seedShopCategory();
      const p = await seedShopProduct(cat.id, { price: 1000, stock: 5 });
      await testAgent().put("/api/v1/admin/shop/city-pricing").set("Authorization", bearer(adminToken)).send({ cities: [{ cityId: a.id, productPriceAdjustPercent: 10 }] });
      await testAgent().put(`/api/v1/admin/shop/products/${p.id}/cities`).set("Authorization", bearer(adminToken)).send({ cities: [{ cityId: b.id, available: false }] });
      const buyer = await seedCustomerWithAddress();
      const token = mintToken({ role: "customer", sub: buyer.sub });
      const place = (city: string | undefined) =>
        testAgent().post("/api/v1/customer/shop/orders").set("Authorization", bearer(token)).send({ items: [{ productId: p.id, quantity: 1 }], addressId: buyer.address.id, idempotencyKey: randomUUID(), ...(city ? { city } : {}) });

      expect((await place(undefined)).status).toBe(400);
      expect((await place("atlantis")).status).toBe(400);
      const blocked = await place(b.slug);
      expect(blocked.status).toBe(409);
      expect(Number((await getDb()("shop_products").where({ id: p.id }).first("stock_quantity")).stock_quantity)).toBe(5);

      const ok = await place(a.slug);
      expect(ok.status).toBe(201);
      expect(ok.body.data.items[0].unitPrice).toBe(1100);
      expect(ok.body.data.total).toBe(1100);
      expect((await getDb()("shop_orders").first("city_id")).city_id).toBe(a.id);
    });
  });
});
