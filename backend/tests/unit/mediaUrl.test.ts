import { z } from "zod";
import { isCanonicalMediaPath, mediaUrlSchema, s3KeyForDelete } from "../../src/shared/mediaUrl";
import { createProductSchema, updateProductSchema } from "../../src/modules/products/products.schema";
import { createCategorySchema } from "../../src/modules/categories/categories.schema";
import { createCitySchema } from "../../src/modules/cities/cities.schema";

const KEY = "library/image/0f1e2d3c-1111-4222-8333-444455556666-My_Photo.webp";
const CANONICAL = `/api/backend/media/file/${KEY}`;
const uuid = "8cae4749-a6bb-461b-be5d-5411bb42134d";

describe("mediaUrlSchema", () => {
  const parse = (v: unknown) => mediaUrlSchema.safeParse(v);

  it.each([
    CANONICAL,
    `/api/backend/media/file/services/${uuid}/a-b.jpg`,
    "/api/backend/media/file/cms/category/a.png",
    "https://cdn.example.com/a.jpg",
    "http://example.com/a.jpg",
  ])("accepts %s unchanged", (value) => {
    const r = parse(value);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe(value);
  });

  it.each([
    [`http://x.elasticbeanstalk.com/api/v1/media/file/${KEY}`],
    [`https://www.growthnova.co.in/api/backend/media/file/${KEY}`],
    [`http://localhost:4000/api/v1/media/file/${KEY}`],
  ])("rewrites this backend's own absolute media URL %s to the canonical path", (value) => {
    const r = parse(value);
    expect(r.success && r.data).toBe(CANONICAL);
  });

  it.each([
    ["other relative path", "/images/a.jpg"],
    ["bare file name", "a.jpg"],
    ["empty string", ""],
    ["traversal", "/api/backend/media/file/library/../../etc/passwd"],
    ["dot-dot mid key", "/api/backend/media/file/library/image/../x.jpg"],
    ["unknown key prefix", "/api/backend/media/file/other/a.jpg"],
    ["query string", `${CANONICAL}?x=1`],
    ["space", "/api/backend/media/file/library/image/a b.jpg"],
    ["double slash", "/api/backend/media/file/library//a.jpg"],
    ["protocol-relative", "//evil.test/a.jpg"],
    ["javascript: url", "javascript:alert(1)"],
    ["data: url", "data:text/html;base64,AAAA"],
    ["over 500 chars", `https://e.com/${"a".repeat(500)}`],
    ["number", 123],
  ])("rejects %s", (_label, value) => {
    expect(parse(value).success).toBe(false);
  });

  it("isCanonicalMediaPath is strict", () => {
    expect(isCanonicalMediaPath(CANONICAL)).toBe(true);
    expect(isCanonicalMediaPath("/api/backend/media/file/library/./a.jpg")).toBe(false);
  });
});

describe("Services catalogue schemas accept the Media Library path", () => {
  const product = { categoryId: uuid, slug: "split-ac", name: "Split AC", description: "d", icon: "wrench" };

  it("products: create, partial update (Enable/Disable re-sends the stored image) and null", () => {
    expect(createProductSchema.safeParse({ ...product, image: CANONICAL }).success).toBe(true);
    expect(createProductSchema.safeParse({ ...product, image: null }).success).toBe(true);
    expect(updateProductSchema.safeParse({ active: false, image: CANONICAL }).success).toBe(true);
    expect(createProductSchema.safeParse({ ...product, image: "/images/a.jpg" }).success).toBe(false);
  });

  it("categories", () => {
    const base = { slug: "ac", name: "AC", description: "d", icon: "snowflake" };
    expect(createCategorySchema.safeParse({ ...base, image: CANONICAL }).success).toBe(true);
    expect(createCategorySchema.safeParse({ ...base, image: "a.jpg" }).success).toBe(false);
  });

  it("cities", () => {
    const base = { name: "Pune", state: "MH", slug: "pune" };
    expect(createCitySchema.safeParse({ ...base, iconUrl: CANONICAL }).success).toBe(true);
    expect(createCitySchema.safeParse({ ...base, iconUrl: "pune.png" }).success).toBe(false);
  });

  it("other fields are still validated", () => {
    expect(createProductSchema.safeParse({ ...product, slug: "Bad Slug", image: CANONICAL }).success).toBe(false);
  });

  it("reports the failing field path for the admin UI", () => {
    const r = createProductSchema.safeParse({ ...product, image: "/images/a.jpg" });
    expect(!r.success && (r.error as z.ZodError).issues[0]?.path).toEqual(["image"]);
  });
});

describe("s3KeyForDelete", () => {
  it("returns the row's own key for valid library/services/cms keys", () => {
    expect(s3KeyForDelete({ s3_key: KEY })).toBe(KEY);
    expect(s3KeyForDelete({ s3_key: "services/abc/x.jpg" })).toBe("services/abc/x.jpg");
  });
  it.each(["../x", "", "other/a", "library/../x", "library//x"])("returns null for %p", (key) => {
    expect(s3KeyForDelete({ s3_key: key })).toBeNull();
  });
});
