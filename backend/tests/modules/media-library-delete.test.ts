import { randomUUID } from "node:crypto";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getDb } from "../../src/database/db";
import { testAgent } from "../helpers/testApp";
import { resetDatabase } from "../helpers/db";
import { bearer, mintToken } from "../helpers/cognitoTestKit";
import { seedCatalogBasics } from "../helpers/factories";

// Only the S3 client is replaced (so no object is ever touched); presigning and every other
// media.service export stay real.
const sendMock = jest.fn();
jest.mock("../../src/modules/media/media.service", () => ({
  ...jest.requireActual("../../src/modules/media/media.service"),
  getS3Client: () => ({ send: sendMock }),
}));

/**
 * Services-catalogue media URLs and Media Library deletion:
 *  - a Library image can be saved on a product/category/city (stored as media.url, the canonical path),
 *  - deleting an in-use image is refused with 409 and never touches S3,
 *  - deleting an unused image removes the S3 object using the row's own s3_key.
 */
describe("media library delete protection and S3 key", () => {
  const adminToken = mintToken({ role: "admin" });
  const admin = () => ({ Authorization: bearer(adminToken) });

  beforeEach(async () => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({});
    await resetDatabase();
    // resetDatabase() does not cover the media table; clear it so keys never collide across tests/runs.
    await getDb()("media").delete();
  });

  async function createLibraryMedia() {
    const key = `library/image/${randomUUID()}-test.png`;
    const res = await testAgent()
      .post("/api/v1/admin/media-library")
      .set(admin())
      .send({ key, mimeType: "image/png", originalFilename: "test.png", fileSizeBytes: 1234 });
    expect(res.status).toBe(201);
    expect(res.body.data.url).toBe(`/api/backend/media/file/${key}`);
    return { id: res.body.data.id as string, url: res.body.data.url as string, key };
  }

  it("deletes the S3 object by the row's s3_key when the media is unused", async () => {
    const media = await createLibraryMedia();
    const res = await testAgent().delete(`/api/v1/admin/media-library/${media.id}`).set(admin());
    expect(res.status).toBe(200);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0]![0] as DeleteObjectCommand;
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input.Key).toBe(media.key);
  });

  it("refuses to delete media used as a product image (409) and does not touch S3", async () => {
    const { category } = await seedCatalogBasics();
    const media = await createLibraryMedia();
    const created = await testAgent()
      .post("/api/v1/admin/products")
      .set(admin())
      .send({ categoryId: category.id, slug: "with-photo", name: "With photo", description: "d", icon: "wrench", image: media.url });
    expect(created.status).toBe(201);
    expect(created.body.data.image).toBe(media.url);

    const del = await testAgent().delete(`/api/v1/admin/media-library/${media.id}`).set(admin());
    expect(del.status).toBe(409);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("refuses to delete media used as a category image or a city icon", async () => {
    const media = await createLibraryMedia();
    const cat = await testAgent()
      .post("/api/v1/admin/categories")
      .set(admin())
      .send({ slug: "cat-photo", name: "Cat", description: "d", icon: "snowflake", image: media.url });
    expect(cat.status).toBe(201);
    expect((await testAgent().delete(`/api/v1/admin/media-library/${media.id}`).set(admin())).status).toBe(409);

    await testAgent().patch(`/api/v1/admin/categories/${cat.body.data.id}`).set(admin()).send({ image: null });
    const city = await testAgent()
      .post("/api/v1/admin/cities")
      .set(admin())
      .send({ name: "Photo City", state: "S", slug: "photo-city", iconUrl: media.url });
    expect(city.status).toBe(201);
    expect((await testAgent().delete(`/api/v1/admin/media-library/${media.id}`).set(admin())).status).toBe(409);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("stores this backend's own absolute media URL in canonical form so delete protection still matches", async () => {
    const { category } = await seedCatalogBasics();
    const media = await createLibraryMedia();
    const created = await testAgent()
      .post("/api/v1/admin/products")
      .set(admin())
      .send({ categoryId: category.id, slug: "abs-photo", name: "Abs", description: "d", icon: "wrench", image: `https://www.growthnova.co.in${media.url}` });
    expect(created.status).toBe(201);
    expect(created.body.data.image).toBe(media.url);
    expect((await testAgent().delete(`/api/v1/admin/media-library/${media.id}`).set(admin())).status).toBe(409);
  });

  it("rejects a non-media relative path with a field-level validation error", async () => {
    const { category } = await seedCatalogBasics();
    const res = await testAgent()
      .post("/api/v1/admin/products")
      .set(admin())
      .send({ categoryId: category.id, slug: "bad-photo", name: "Bad", description: "d", icon: "wrench", image: "/images/a.jpg" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].path).toBe("image");
  });
});
