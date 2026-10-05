import { testAgent } from "../helpers/testApp";
import { resetDatabase } from "../helpers/db";
import { bearer, mintToken } from "../helpers/cognitoTestKit";
import { seedCatalogBasics, seedService } from "../helpers/factories";

/**
 * PHASE_3 brief — AUTHORIZATION scenarios: `requireRole()` (declarative role
 * gate) and `requireOwnership()` (resource-owner-vs-caller comparison) never
 * trust anything the frontend claims — only the verified token's own role
 * and sub. "Never authorize merely because the frontend displays an Admin UI."
 */
describe("authorization", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("blocks a customer-role token from an admin-only route", async () => {
    const token = mintToken({ role: "customer" });
    const res = await testAgent().get("/api/v1/admin/listings/pending").set("Authorization", bearer(token));
    expect(res.status).toBe(403);
  });

  it("blocks a provider-role token from an admin-only route", async () => {
    const token = mintToken({ role: "provider" });
    const res = await testAgent().get("/api/v1/admin/listings/pending").set("Authorization", bearer(token));
    expect(res.status).toBe(403);
  });

  it("allows an admin-role token onto an admin-only route", async () => {
    const token = mintToken({ role: "admin" });
    const res = await testAgent().get("/api/v1/admin/listings/pending").set("Authorization", bearer(token));
    expect(res.status).toBe(200);
  });

  it("never grants access based on a client-claimed role — only the token's verified group claim decides", async () => {
    // A customer-role token cannot become an admin by any request-body/header trick; the
    // route's requireRole("admin") only ever looks at req.auth.role, set solely from the
    // verified `cognito:groups` claim.
    const token = mintToken({ role: "customer" });
    const res = await testAgent()
      .get("/api/v1/admin/listings/pending")
      .set("Authorization", bearer(token))
      .set("X-User-Role", "admin");
    expect(res.status).toBe(403);
  });

  it("prevents one provider from editing another provider's listing (ownership check)", async () => {
    const { product, serviceType } = await seedCatalogBasics();
    const ownerSub = "11111111-1111-4111-8111-111111111111";
    const listing = await seedService({
      productId: product.id,
      serviceTypeId: serviceType.id,
      createdByRole: "provider",
      createdByUserId: ownerSub,
      approve: false,
    });

    const otherProviderToken = mintToken({ role: "provider", sub: "22222222-2222-4222-8222-222222222222" });
    const res = await testAgent()
      .patch(`/api/v1/provider/listings/${listing.id}`)
      .set("Authorization", bearer(otherProviderToken))
      .send({ name: "Hijacked name" });

    expect(res.status).toBe(403);
  });

  it("lets the owning provider edit their own listing", async () => {
    const { product, serviceType } = await seedCatalogBasics();
    const ownerSub = "33333333-3333-4333-8333-333333333333";
    const listing = await seedService({
      productId: product.id,
      serviceTypeId: serviceType.id,
      createdByRole: "provider",
      createdByUserId: ownerSub,
      approve: false,
    });

    const ownerToken = mintToken({ role: "provider", sub: ownerSub });
    const res = await testAgent()
      .patch(`/api/v1/provider/listings/${listing.id}`)
      .set("Authorization", bearer(ownerToken))
      .send({ name: "Updated by owner" });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Updated by owner");
  });

  it("returns 404 (not 403) for an ownership check against a resource that does not exist, so a non-owner learns nothing", async () => {
    const token = mintToken({ role: "provider" });
    const res = await testAgent()
      .patch("/api/v1/provider/listings/00000000-0000-4000-8000-000000000000")
      .set("Authorization", bearer(token))
      .send({ name: "x" });
    expect(res.status).toBe(404);
  });

  it("prevents a customer from reading another customer's saved address", async () => {
    const customerAToken = mintToken({ role: "customer", sub: "44444444-4444-4444-8444-444444444444" });
    const customerBToken = mintToken({ role: "customer", sub: "55555555-5555-4555-8555-555555555555" });

    const createRes = await testAgent()
      .post("/api/v1/customer/addresses")
      .set("Authorization", bearer(customerAToken))
      .send({ label: "Home", line1: "1 Test Street", city: "Testville", state: "TS", pincode: "123456" });
    expect(createRes.status).toBe(201);
    const addressId = createRes.body.data.id;

    const res = await testAgent()
      .patch(`/api/v1/customer/addresses/${addressId}`)
      .set("Authorization", bearer(customerBToken))
      .send({ label: "Hijacked" });
    expect(res.status).toBe(403);
  });
});
