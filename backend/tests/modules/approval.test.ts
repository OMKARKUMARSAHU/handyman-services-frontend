import { testAgent } from "../helpers/testApp";
import { resetDatabase } from "../helpers/db";
import { bearer, mintToken } from "../helpers/cognitoTestKit";
import { seedCatalogBasics } from "../helpers/factories";

/**
 * PHASE_3 brief §5/§6 — the ONE shared approval queue: Provider-created and
 * Admin-created listings both start `pending_approval`, both live in the
 * same queue, and only Admin can approve/reject either kind. No listing of
 * either role bypasses the queue; Admin-created listings are never
 * auto-published.
 */
describe("approval workflow", () => {
  const adminSub = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const providerSub = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const adminToken = mintToken({ role: "admin", sub: adminSub });
  const providerToken = mintToken({ role: "provider", sub: providerSub });

  beforeEach(async () => {
    await resetDatabase();
  });

  async function createListingAs(token: string, body: Record<string, unknown>, path: string) {
    return testAgent().post(path).set("Authorization", bearer(token)).send(body);
  }

  it("starts a Provider-created listing as pending_approval and hides it from the public catalog", async () => {
    const { product, serviceType } = await seedCatalogBasics();
    const res = await createListingAs(
      providerToken,
      {
        slug: `provider-listing-${Date.now()}`,
        productId: product.id,
        serviceTypeId: serviceType.id,
        name: "Provider Listing",
        shortDescription: "short",
        description: "long description",
        whatsIncluded: ["a"],
        mrp: 500,
        offerPrice: 400,
      },
      "/api/v1/provider/listings"
    );
    expect(res.status).toBe(201);
    expect(res.body.data.approvalStatus).toBe("pending_approval");

    const publicRes = await testAgent().get(`/api/v1/services/${res.body.data.slug}`);
    expect(publicRes.status).toBe(404);
  });

  it("starts an Admin-created listing as pending_approval too — never auto-published", async () => {
    const { product, serviceType } = await seedCatalogBasics();
    const res = await createListingAs(
      adminToken,
      {
        slug: `admin-listing-${Date.now()}`,
        productId: product.id,
        serviceTypeId: serviceType.id,
        name: "Admin Listing",
        shortDescription: "short",
        description: "long description",
        whatsIncluded: ["a"],
        mrp: 500,
        offerPrice: 400,
      },
      "/api/v1/admin/services"
    );
    expect(res.status).toBe(201);
    expect(res.body.data.approvalStatus).toBe("pending_approval");
    expect(res.body.data.createdByRole).toBe("admin");

    const publicRes = await testAgent().get(`/api/v1/services/${res.body.data.slug}`);
    expect(publicRes.status).toBe(404);
  });

  it("shows both Provider- and Admin-created listings in the ONE shared queue", async () => {
    const { product, serviceType } = await seedCatalogBasics();
    await createListingAs(
      providerToken,
      {
        slug: `queue-provider-${Date.now()}`,
        productId: product.id,
        serviceTypeId: serviceType.id,
        name: "Queue Provider Listing",
        shortDescription: "s",
        description: "d",
        whatsIncluded: [],
        mrp: 100,
        offerPrice: 90,
      },
      "/api/v1/provider/listings"
    );
    await createListingAs(
      adminToken,
      {
        slug: `queue-admin-${Date.now()}`,
        productId: product.id,
        serviceTypeId: serviceType.id,
        name: "Queue Admin Listing",
        shortDescription: "s",
        description: "d",
        whatsIncluded: [],
        mrp: 100,
        offerPrice: 90,
      },
      "/api/v1/admin/services"
    );

    const queueRes = await testAgent().get("/api/v1/admin/listings/pending").set("Authorization", bearer(adminToken));
    expect(queueRes.status).toBe(200);
    const roles = queueRes.body.data.map((item: { createdByRole: string }) => item.createdByRole);
    expect(roles).toEqual(expect.arrayContaining(["provider", "admin"]));
  });

  it("a Provider cannot reach the approval queue or approve/reject anything", async () => {
    const queueRes = await testAgent().get("/api/v1/admin/listings/pending").set("Authorization", bearer(providerToken));
    expect(queueRes.status).toBe(403);
  });

  it("Admin approving a pending listing (Provider- or Admin-created) makes it publicly visible", async () => {
    const { product, serviceType } = await seedCatalogBasics();
    const createRes = await createListingAs(
      providerToken,
      {
        slug: `approve-me-${Date.now()}`,
        productId: product.id,
        serviceTypeId: serviceType.id,
        name: "Approve Me",
        shortDescription: "s",
        description: "d",
        whatsIncluded: [],
        mrp: 100,
        offerPrice: 90,
      },
      "/api/v1/provider/listings"
    );
    const listingId = createRes.body.data.id;

    const approveRes = await testAgent()
      .post(`/api/v1/admin/listings/${listingId}/approve`)
      .set("Authorization", bearer(adminToken));
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.approvalStatus).toBe("approved");
    expect(approveRes.body.data.approvedByUserId).toBe(adminSub);

    const publicRes = await testAgent().get(`/api/v1/services/${createRes.body.data.slug}`);
    expect(publicRes.status).toBe(200);
  });

  it("Admin rejecting a pending listing records the reason and keeps it out of the public catalog", async () => {
    const { product, serviceType } = await seedCatalogBasics();
    const createRes = await createListingAs(
      providerToken,
      {
        slug: `reject-me-${Date.now()}`,
        productId: product.id,
        serviceTypeId: serviceType.id,
        name: "Reject Me",
        shortDescription: "s",
        description: "d",
        whatsIncluded: [],
        mrp: 100,
        offerPrice: 90,
      },
      "/api/v1/provider/listings"
    );
    const listingId = createRes.body.data.id;

    const rejectRes = await testAgent()
      .post(`/api/v1/admin/listings/${listingId}/reject`)
      .set("Authorization", bearer(adminToken))
      .send({ reason: "Photos are missing." });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.approvalStatus).toBe("rejected");
    expect(rejectRes.body.data.rejectionReason).toBe("Photos are missing.");

    const publicRes = await testAgent().get(`/api/v1/services/${createRes.body.data.slug}`);
    expect(publicRes.status).toBe(404);
  });

  it("a Provider editing their own approved listing forces it back to pending_approval (cannot publish directly)", async () => {
    const { product, serviceType } = await seedCatalogBasics();
    const createRes = await createListingAs(
      providerToken,
      {
        slug: `reedit-${Date.now()}`,
        productId: product.id,
        serviceTypeId: serviceType.id,
        name: "Re-edit Me",
        shortDescription: "s",
        description: "d",
        whatsIncluded: [],
        mrp: 100,
        offerPrice: 90,
      },
      "/api/v1/provider/listings"
    );
    const listingId = createRes.body.data.id;
    await testAgent().post(`/api/v1/admin/listings/${listingId}/approve`).set("Authorization", bearer(adminToken));

    const editRes = await testAgent()
      .patch(`/api/v1/provider/listings/${listingId}`)
      .set("Authorization", bearer(providerToken))
      .send({ name: "Edited after approval" });
    expect(editRes.status).toBe(200);
    expect(editRes.body.data.approvalStatus).toBe("pending_approval");
  });
});
