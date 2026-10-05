import { testAgent } from "../helpers/testApp";
import { resetDatabase } from "../helpers/db";
import { bearer, mintToken } from "../helpers/cognitoTestKit";
import { seedCatalogBasics, seedService } from "../helpers/factories";

/**
 * PHASE_3 brief — CART scenarios: the server-persisted cart exists only for
 * an authenticated customer; it must handle removed/inactive/unavailable
 * services, changed prices, and city availability, and it must never let an
 * unauthenticated caller touch it.
 */
describe("cart", () => {
  const customerToken = mintToken({ role: "customer", sub: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" });
  const adminToken = mintToken({ role: "admin" });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("rejects every cart endpoint for an unauthenticated caller", async () => {
    const getRes = await testAgent().get("/api/v1/customer/cart");
    expect(getRes.status).toBe(401);
    const postRes = await testAgent()
      .post("/api/v1/customer/cart/items")
      .send({ serviceId: "00000000-0000-4000-8000-000000000000", cityId: "00000000-0000-4000-8000-000000000000", quantity: 1 });
    expect(postRes.status).toBe(401);
  });

  it("rejects adding a service that is not offered in the given city", async () => {
    const { product, serviceType, city } = await seedCatalogBasics();
    const service = await seedService({ productId: product.id, serviceTypeId: serviceType.id, approve: true }); // no city availability set

    const res = await testAgent()
      .post("/api/v1/customer/cart/items")
      .set("Authorization", bearer(customerToken))
      .send({ serviceId: service.id, cityId: city.id, quantity: 1 });
    expect(res.status).toBe(409);
  });

  it("adds an item, and adding the same (service, city) pair again sums the quantity", async () => {
    const { product, serviceType, city } = await seedCatalogBasics();
    const service = await seedService({ productId: product.id, serviceTypeId: serviceType.id, cityId: city.id, approve: true });

    const first = await testAgent()
      .post("/api/v1/customer/cart/items")
      .set("Authorization", bearer(customerToken))
      .send({ serviceId: service.id, cityId: city.id, quantity: 2 });
    expect(first.status).toBe(201);

    const second = await testAgent()
      .post("/api/v1/customer/cart/items")
      .set("Authorization", bearer(customerToken))
      .send({ serviceId: service.id, cityId: city.id, quantity: 3 });
    expect(second.status).toBe(201);
    expect(second.body.data.items).toHaveLength(1);
    expect(second.body.data.items[0].quantity).toBe(5);
    expect(second.body.data.subtotal).toBe(service.offerPrice * 5);
  });

  it("updates quantity and removes an item", async () => {
    const { product, serviceType, city } = await seedCatalogBasics();
    const service = await seedService({ productId: product.id, serviceTypeId: serviceType.id, cityId: city.id, approve: true });
    const addRes = await testAgent()
      .post("/api/v1/customer/cart/items")
      .set("Authorization", bearer(customerToken))
      .send({ serviceId: service.id, cityId: city.id, quantity: 1 });
    const itemId = addRes.body.data.items[0].id;

    const updateRes = await testAgent()
      .patch(`/api/v1/customer/cart/items/${itemId}`)
      .set("Authorization", bearer(customerToken))
      .send({ quantity: 4 });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.items[0].quantity).toBe(4);

    const removeRes = await testAgent()
      .delete(`/api/v1/customer/cart/items/${itemId}`)
      .set("Authorization", bearer(customerToken));
    expect(removeRes.status).toBe(200);
    expect(removeRes.body.data.items).toHaveLength(0);
  });

  it("flags a cart item as unavailable once its service is deactivated, and excludes it from the subtotal", async () => {
    const { product, serviceType, city } = await seedCatalogBasics();
    const service = await seedService({ productId: product.id, serviceTypeId: serviceType.id, cityId: city.id, approve: true });
    await testAgent()
      .post("/api/v1/customer/cart/items")
      .set("Authorization", bearer(customerToken))
      .send({ serviceId: service.id, cityId: city.id, quantity: 2 });

    const deactivateRes = await testAgent()
      .patch(`/api/v1/admin/services/${service.id}`)
      .set("Authorization", bearer(adminToken))
      .send({ active: false });
    expect(deactivateRes.status).toBe(200);

    const cartRes = await testAgent().get("/api/v1/customer/cart").set("Authorization", bearer(customerToken));
    expect(cartRes.status).toBe(200);
    expect(cartRes.body.data.items[0].isAvailable).toBe(false);
    expect(cartRes.body.data.subtotal).toBe(0);
    expect(cartRes.body.data.hasStaleItems).toBe(true);
  });

  it("merges a local (anonymous) cart into the server cart at login, skipping items that are no longer purchasable", async () => {
    const { product, serviceType, city } = await seedCatalogBasics();
    const goodService = await seedService({ productId: product.id, serviceTypeId: serviceType.id, cityId: city.id, approve: true });

    const res = await testAgent()
      .post("/api/v1/customer/cart/merge")
      .set("Authorization", bearer(customerToken))
      .send({
        items: [
          { serviceId: goodService.id, cityId: city.id, quantity: 2 },
          { serviceId: "00000000-0000-4000-8000-000000000000", cityId: city.id, quantity: 1 },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].quantity).toBe(2);
    expect(res.body.meta?.skipped).toHaveLength(1);
  });
});
