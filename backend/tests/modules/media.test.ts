import { testAgent } from "../helpers/testApp";
import { resetDatabase } from "../helpers/db";
import { bearer, mintToken } from "../helpers/cognitoTestKit";
import { seedCatalogBasics, seedService } from "../helpers/factories";

/**
 * PHASE_3 brief — MEDIA scenarios. Presigning a PUT URL is pure local SigV4
 * signing (no network call to AWS), so this runs against the fake local
 * bucket/credentials in tests/.env (see the comment there) rather than
 * mocking the AWS SDK — the same "genuine, not bypassed" standard used for
 * Cognito verification in auth.test.ts. No real S3 object is ever touched.
 */
describe("media", () => {
  const adminToken = mintToken({ role: "admin" });
  const ownerSub = "ffffffff-ffff-4fff-8fff-ffffffffffff";
  const ownerToken = mintToken({ role: "provider", sub: ownerSub });
  const otherProviderToken = mintToken({ role: "provider", sub: "99999999-9999-4999-8999-999999999999" });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("rejects an unsupported content type before issuing a pre-signed URL", async () => {
    const { product, serviceType } = await seedCatalogBasics();
    const listing = await seedService({
      productId: product.id,
      serviceTypeId: serviceType.id,
      createdByRole: "provider",
      createdByUserId: ownerSub,
      approve: false,
    });

    const res = await testAgent()
      .post("/api/v1/media/upload-url")
      .set("Authorization", bearer(ownerToken))
      .send({ serviceId: listing.id, fileName: "malware.exe", contentType: "application/x-msdownload", fileSizeBytes: 1000 });
    expect(res.status).toBe(409);
  });

  it("rejects a file over the configured size limit", async () => {
    const { product, serviceType } = await seedCatalogBasics();
    const listing = await seedService({
      productId: product.id,
      serviceTypeId: serviceType.id,
      createdByRole: "provider",
      createdByUserId: ownerSub,
      approve: false,
    });

    const res = await testAgent()
      .post("/api/v1/media/upload-url")
      .set("Authorization", bearer(ownerToken))
      .send({ serviceId: listing.id, fileName: "huge.jpg", contentType: "image/jpeg", fileSizeBytes: 999_999_999 });
    expect(res.status).toBe(409);
  });

  it("issues a pre-signed URL to the owning provider for their own pending listing", async () => {
    const { product, serviceType } = await seedCatalogBasics();
    const listing = await seedService({
      productId: product.id,
      serviceTypeId: serviceType.id,
      createdByRole: "provider",
      createdByUserId: ownerSub,
      approve: false,
    });

    const res = await testAgent()
      .post("/api/v1/media/upload-url")
      .set("Authorization", bearer(ownerToken))
      .send({ serviceId: listing.id, fileName: "photo.jpg", contentType: "image/jpeg", fileSizeBytes: 500_000 });
    expect(res.status).toBe(200);
    expect(typeof res.body.data.uploadUrl).toBe("string");
    expect(res.body.data.key).toContain(`services/${listing.id}/`);
  });

  it("blocks a different provider from requesting an upload URL for someone else's listing", async () => {
    const { product, serviceType } = await seedCatalogBasics();
    const listing = await seedService({
      productId: product.id,
      serviceTypeId: serviceType.id,
      createdByRole: "provider",
      createdByUserId: ownerSub,
      approve: false,
    });

    const res = await testAgent()
      .post("/api/v1/media/upload-url")
      .set("Authorization", bearer(otherProviderToken))
      .send({ serviceId: listing.id, fileName: "photo.jpg", contentType: "image/jpeg", fileSizeBytes: 500_000 });
    expect(res.status).toBe(403);
  });

  it("blocks the owning provider from managing media once their listing is approved", async () => {
    const { product, serviceType } = await seedCatalogBasics();
    const listing = await seedService({
      productId: product.id,
      serviceTypeId: serviceType.id,
      createdByRole: "provider",
      createdByUserId: ownerSub,
      approve: true,
    });

    const res = await testAgent()
      .post("/api/v1/media/upload-url")
      .set("Authorization", bearer(ownerToken))
      .send({ serviceId: listing.id, fileName: "photo.jpg", contentType: "image/jpeg", fileSizeBytes: 500_000 });
    expect(res.status).toBe(409);
  });

  it("lets Admin manage media on any listing regardless of approval status", async () => {
    const { product, serviceType } = await seedCatalogBasics();
    const listing = await seedService({
      productId: product.id,
      serviceTypeId: serviceType.id,
      createdByRole: "provider",
      createdByUserId: ownerSub,
      approve: true,
    });

    const res = await testAgent()
      .post("/api/v1/media/upload-url")
      .set("Authorization", bearer(adminToken))
      .send({ serviceId: listing.id, fileName: "photo.jpg", contentType: "image/jpeg", fileSizeBytes: 500_000 });
    expect(res.status).toBe(200);
  });

  it("attaches an image record after a successful upload, then allows the owner to delete it", async () => {
    const { product, serviceType } = await seedCatalogBasics();
    const listing = await seedService({
      productId: product.id,
      serviceTypeId: serviceType.id,
      createdByRole: "provider",
      createdByUserId: ownerSub,
      approve: false,
    });

    const attachRes = await testAgent()
      .post(`/api/v1/media/${listing.id}/images`)
      .set("Authorization", bearer(ownerToken))
      .send({ key: `services/${listing.id}/test-key.jpg`, alt: "A test photo", sortOrder: 0 });
    expect(attachRes.status).toBe(201);
    expect(attachRes.body.data.serviceId).toBe(listing.id);
    expect(attachRes.body.data.url).toContain("test-key.jpg");

    const deleteRes = await testAgent()
      .delete(`/api/v1/media/images/${attachRes.body.data.id}`)
      .set("Authorization", bearer(ownerToken));
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.data.success).toBe(true);
  });

  it("rejects media routes for a customer-role token", async () => {
    const customerToken = mintToken({ role: "customer" });
    const res = await testAgent()
      .post("/api/v1/media/upload-url")
      .set("Authorization", bearer(customerToken))
      .send({ serviceId: "00000000-0000-4000-8000-000000000000", fileName: "x.jpg", contentType: "image/jpeg", fileSizeBytes: 1 });
    expect(res.status).toBe(403);
  });
});
