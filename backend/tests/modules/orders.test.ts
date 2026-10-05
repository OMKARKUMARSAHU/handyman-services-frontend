import { randomUUID } from "node:crypto";
import { testAgent } from "../helpers/testApp";
import { resetDatabase } from "../helpers/db";
import { bearer, mintToken } from "../helpers/cognitoTestKit";
import { seedCatalogBasics, seedService } from "../helpers/factories";

/**
 * PHASE_3 brief — ORDERS scenarios: the most security-critical write in the
 * backend. `orders.customer_id` is `NOT NULL`, so an unauthenticated caller
 * can structurally never create an order; every price is re-derived from
 * `services` at order time, never trusted from the cart or the request body.
 */
describe("orders", () => {
  const customerToken = mintToken({ role: "customer", sub: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" });
  const otherCustomerToken = mintToken({ role: "customer", sub: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" });
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

  it("cannot be created by an unauthenticated caller under any circumstances", async () => {
    const res = await testAgent()
      .post("/api/v1/customer/orders")
      .send({ addressId: randomUUID(), scheduledDate: "2026-12-01", idempotencyKey: randomUUID() });
    expect(res.status).toBe(401);
  });

  it("rejects order creation when the customer's cart is empty", async () => {
    const addressId = await addressFor(customerToken);
    const res = await testAgent()
      .post("/api/v1/customer/orders")
      .set("Authorization", bearer(customerToken))
      .send({ addressId, scheduledDate: "2026-12-01", idempotencyKey: randomUUID() });
    expect(res.status).toBe(409);
  });

  it("creates an order with server-computed totals, snapshots the address, and clears the cart", async () => {
    const { product, serviceType, city } = await seedCatalogBasics();
    const service = await seedService({
      productId: product.id,
      serviceTypeId: serviceType.id,
      cityId: city.id,
      mrp: 1000,
      offerPrice: 800,
      approve: true,
    });
    await testAgent()
      .post("/api/v1/customer/cart/items")
      .set("Authorization", bearer(customerToken))
      .send({ serviceId: service.id, cityId: city.id, quantity: 2 });

    const addressId = await addressFor(customerToken);
    const res = await testAgent()
      .post("/api/v1/customer/orders")
      .set("Authorization", bearer(customerToken))
      .send({ addressId, scheduledDate: "2026-12-01", scheduledSlot: "morning", idempotencyKey: randomUUID() });

    expect(res.status).toBe(201);
    expect(res.body.data.subtotal).toBe(2000); // 1000 * 2
    expect(res.body.data.discountTotal).toBe(400); // (1000-800) * 2
    expect(res.body.data.total).toBe(1600); // 800 * 2
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].unitPrice).toBe(800);
    expect(res.body.data.address.line1).toBe("221B Test Lane");
    expect(res.body.data.status).toBe("pending");

    const cartRes = await testAgent().get("/api/v1/customer/cart").set("Authorization", bearer(customerToken));
    expect(cartRes.body.data.items).toHaveLength(0);
  });

  it("re-fetches the live price at order time rather than trusting the price cached in the cart", async () => {
    const { product, serviceType, city } = await seedCatalogBasics();
    const service = await seedService({
      productId: product.id,
      serviceTypeId: serviceType.id,
      cityId: city.id,
      mrp: 1000,
      offerPrice: 800,
      approve: true,
    });
    await testAgent()
      .post("/api/v1/customer/cart/items")
      .set("Authorization", bearer(customerToken))
      .send({ serviceId: service.id, cityId: city.id, quantity: 1 });

    // Admin drops the price after the item was added to the cart.
    await testAgent()
      .patch(`/api/v1/admin/services/${service.id}`)
      .set("Authorization", bearer(adminToken))
      .send({ offerPrice: 500 });

    const addressId = await addressFor(customerToken);
    const res = await testAgent()
      .post("/api/v1/customer/orders")
      .set("Authorization", bearer(customerToken))
      .send({ addressId, scheduledDate: "2026-12-01", idempotencyKey: randomUUID() });

    expect(res.status).toBe(201);
    expect(res.body.data.total).toBe(500); // live price at order time, not the stale 800 cached in the cart
  });

  it("never lets a client-submitted price/total influence the created order", async () => {
    const { product, serviceType, city } = await seedCatalogBasics();
    const service = await seedService({
      productId: product.id,
      serviceTypeId: serviceType.id,
      cityId: city.id,
      mrp: 1000,
      offerPrice: 800,
      approve: true,
    });
    await testAgent()
      .post("/api/v1/customer/cart/items")
      .set("Authorization", bearer(customerToken))
      .send({ serviceId: service.id, cityId: city.id, quantity: 1 });

    const addressId = await addressFor(customerToken);
    const res = await testAgent()
      .post("/api/v1/customer/orders")
      .set("Authorization", bearer(customerToken))
      // Extra, unsupported fields a malicious client might try to inject.
      .send({
        addressId,
        scheduledDate: "2026-12-01",
        idempotencyKey: randomUUID(),
        total: 1,
        subtotal: 1,
        discountTotal: 999,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.total).toBe(800);
    expect(res.body.data.subtotal).toBe(1000);
  });

  it("returns the same order when the same idempotency key is submitted twice, without creating a duplicate", async () => {
    const { product, serviceType, city } = await seedCatalogBasics();
    const service = await seedService({
      productId: product.id,
      serviceTypeId: serviceType.id,
      cityId: city.id,
      approve: true,
    });
    const idempotencyKey = randomUUID();
    const addressId = await addressFor(customerToken);

    await testAgent()
      .post("/api/v1/customer/cart/items")
      .set("Authorization", bearer(customerToken))
      .send({ serviceId: service.id, cityId: city.id, quantity: 1 });
    const first = await testAgent()
      .post("/api/v1/customer/orders")
      .set("Authorization", bearer(customerToken))
      .send({ addressId, scheduledDate: "2026-12-01", idempotencyKey });
    expect(first.status).toBe(201);

    const second = await testAgent()
      .post("/api/v1/customer/orders")
      .set("Authorization", bearer(customerToken))
      .send({ addressId, scheduledDate: "2026-12-01", idempotencyKey });
    expect(second.status).toBe(201);
    expect(second.body.data.id).toBe(first.body.data.id);

    const listRes = await testAgent().get("/api/v1/customer/orders").set("Authorization", bearer(customerToken));
    expect(listRes.body.data).toHaveLength(1);
  });

  it("prevents a customer from viewing another customer's order", async () => {
    const { product, serviceType, city } = await seedCatalogBasics();
    const service = await seedService({ productId: product.id, serviceTypeId: serviceType.id, cityId: city.id, approve: true });
    await testAgent()
      .post("/api/v1/customer/cart/items")
      .set("Authorization", bearer(customerToken))
      .send({ serviceId: service.id, cityId: city.id, quantity: 1 });
    const addressId = await addressFor(customerToken);
    const createRes = await testAgent()
      .post("/api/v1/customer/orders")
      .set("Authorization", bearer(customerToken))
      .send({ addressId, scheduledDate: "2026-12-01", idempotencyKey: randomUUID() });

    const res = await testAgent()
      .get(`/api/v1/customer/orders/${createRes.body.data.id}`)
      .set("Authorization", bearer(otherCustomerToken));
    // The order exists but belongs to someone else — requireOwnership() returns 403 here
    // (404 is reserved for a resource that genuinely doesn't exist at all).
    expect(res.status).toBe(403);
  });

  it("lets Admin list all orders and update an order's status", async () => {
    const { product, serviceType, city } = await seedCatalogBasics();
    const service = await seedService({ productId: product.id, serviceTypeId: serviceType.id, cityId: city.id, approve: true });
    await testAgent()
      .post("/api/v1/customer/cart/items")
      .set("Authorization", bearer(customerToken))
      .send({ serviceId: service.id, cityId: city.id, quantity: 1 });
    const addressId = await addressFor(customerToken);
    const createRes = await testAgent()
      .post("/api/v1/customer/orders")
      .set("Authorization", bearer(customerToken))
      .send({ addressId, scheduledDate: "2026-12-01", idempotencyKey: randomUUID() });

    const listRes = await testAgent().get("/api/v1/admin/orders").set("Authorization", bearer(adminToken));
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);

    const patchRes = await testAgent()
      .patch(`/api/v1/admin/orders/${createRes.body.data.id}`)
      .set("Authorization", bearer(adminToken))
      .send({ status: "confirmed" });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.status).toBe("confirmed");
  });
});
