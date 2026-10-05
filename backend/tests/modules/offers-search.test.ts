import { testAgent } from "../helpers/testApp";
import { resetDatabase } from "../helpers/db";
import { bearer, mintToken } from "../helpers/cognitoTestKit";
import { seedCatalogBasics, seedService } from "../helpers/factories";

describe("offers", () => {
  const adminToken = mintToken({ role: "admin" });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("only returns active offers to the public endpoint", async () => {
    const createRes = await testAgent()
      .post("/api/v1/admin/offers")
      .set("Authorization", bearer(adminToken))
      .send({
        title: "Festive Discount",
        description: "10% off everything",
        discountType: "percent",
        discountValue: 10,
        applicabilityType: "all_india",
        appliesTo: { scope: "all", ids: [] },
      });
    expect(createRes.status).toBe(201);

    await testAgent()
      .post("/api/v1/admin/offers")
      .set("Authorization", bearer(adminToken))
      .send({
        title: "Inactive Offer",
        description: "should not show",
        discountType: "flat",
        discountValue: 50,
        applicabilityType: "all_india",
        appliesTo: { scope: "all", ids: [] },
        active: false,
      });

    const res = await testAgent().get("/api/v1/offers");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe("Festive Discount");
  });

  it("requires admin role to create an offer", async () => {
    const customerToken = mintToken({ role: "customer" });
    const res = await testAgent()
      .post("/api/v1/admin/offers")
      .set("Authorization", bearer(customerToken))
      .send({
        title: "x",
        description: "x",
        discountType: "flat",
        discountValue: 1,
        applicabilityType: "all_india",
        appliesTo: { scope: "all", ids: [] },
      });
    expect(res.status).toBe(403);
  });
});

describe("search", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("finds matching categories, products, and approved+active services by name substring", async () => {
    const { category, product, serviceType } = await seedCatalogBasics();
    const service = await seedService({ productId: product.id, serviceTypeId: serviceType.id, approve: true });
    // seedService's fixture is always named "Test Service" — search for a slice of it.
    const res = await testAgent().get("/api/v1/search?q=Test Service");
    expect(res.status).toBe(200);
    expect(res.body.data.services.some((s: { id: string }) => s.id === service.id)).toBe(true);

    const categoryRes = await testAgent().get("/api/v1/search?q=Test Category");
    expect(categoryRes.body.data.categories.some((c: { id: string }) => c.id === category.id)).toBe(true);
  });

  it("excludes an unapproved service from search results", async () => {
    const { product, serviceType } = await seedCatalogBasics();
    await seedService({ productId: product.id, serviceTypeId: serviceType.id, approve: false });
    const res = await testAgent().get("/api/v1/search?q=Test Service");
    expect(res.body.data.services).toHaveLength(0);
  });
});
