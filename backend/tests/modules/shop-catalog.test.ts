import { randomUUID } from "node:crypto";
import { testAgent } from "../helpers/testApp";
import { resetDatabase } from "../helpers/db";
import { bearer, mintToken } from "../helpers/cognitoTestKit";
import { seedMedia, seedShopCategory, seedShopProduct } from "../helpers/shopFactories";
import { parseYouTubeId } from "../../src/modules/shop/shopProducts.service";

/**
 * E-commerce catalogue: public visibility rules (drafts/inactive never leak),
 * search/filter/sort/pagination, admin authorization, CRUD and validation of
 * price, SKU, images and videos.
 */
describe("shop catalogue — public", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("lists only published + active products in active categories", async () => {
    const cat = await seedShopCategory({ name: "Water Purifiers" });
    const hiddenCat = await seedShopCategory({ name: "Hidden Cat", active: false });
    await seedShopProduct(cat.id, { name: "Visible One" });
    await seedShopProduct(cat.id, { name: "Draft One", status: "draft" });
    await seedShopProduct(cat.id, { name: "Inactive One", active: false });
    await seedShopProduct(hiddenCat.id, { name: "In Hidden Category" });

    const res = await testAgent().get("/api/v1/shop/products");
    expect(res.status).toBe(200);
    expect(res.body.data.map((p: { name: string }) => p.name)).toEqual(["Visible One"]);
    expect(res.body.meta.total).toBe(1);

    const cats = await testAgent().get("/api/v1/shop/categories");
    expect(cats.body.data.map((c: { name: string }) => c.name)).toEqual(["Water Purifiers"]);
    expect(cats.body.data[0].productCount).toBe(1);
  });

  it("returns 404 for draft, inactive and hidden-category product detail pages", async () => {
    const cat = await seedShopCategory();
    const hiddenCat = await seedShopCategory({ active: false });
    const draft = await seedShopProduct(cat.id, { status: "draft" });
    const inactive = await seedShopProduct(cat.id, { active: false });
    const inHidden = await seedShopProduct(hiddenCat.id);
    const live = await seedShopProduct(cat.id);

    for (const p of [draft, inactive, inHidden]) {
      expect((await testAgent().get(`/api/v1/shop/products/${p.slug}`)).status).toBe(404);
    }
    expect((await testAgent().get(`/api/v1/shop/products/${live.slug}`)).status).toBe(200);
  });

  it("never exposes stock counts or admin-only fields on public responses", async () => {
    const cat = await seedShopCategory();
    const p = await seedShopProduct(cat.id, { stock: 7 });
    const list = await testAgent().get("/api/v1/shop/products");
    const detail = await testAgent().get(`/api/v1/shop/products/${p.slug}`);
    for (const body of [list.body.data[0], detail.body.data.product]) {
      expect(body).not.toHaveProperty("stockQuantity");
      expect(body).not.toHaveProperty("lowStockThreshold");
      expect(body).not.toHaveProperty("status");
      expect(body).not.toHaveProperty("active");
    }
  });

  it("supports search, category filter, price sort, in-stock filter and pagination", async () => {
    const a = await seedShopCategory({ name: "Alpha" });
    const b = await seedShopCategory({ name: "Beta" });
    await seedShopProduct(a.id, { name: "RO Membrane", price: 1500, sku: "A-1" });
    await seedShopProduct(a.id, { name: "Sediment Filter", price: 300, sku: "A-2" });
    await seedShopProduct(b.id, { name: "AC Filter", price: 400, sku: "B-1", stock: 0 });

    const search = await testAgent().get("/api/v1/shop/products").query({ search: "membrane" });
    expect(search.body.data.map((p: { name: string }) => p.name)).toEqual(["RO Membrane"]);

    const bySku = await testAgent().get("/api/v1/shop/products").query({ search: "B-1" });
    expect(bySku.body.data).toHaveLength(1);

    const byCat = await testAgent().get("/api/v1/shop/products").query({ category: b.slug });
    expect(byCat.body.data.map((p: { name: string }) => p.name)).toEqual(["AC Filter"]);

    const asc = await testAgent().get("/api/v1/shop/products").query({ sort: "price_asc" });
    expect(asc.body.data.map((p: { price: number }) => p.price)).toEqual([300, 400, 1500]);
    const desc = await testAgent().get("/api/v1/shop/products").query({ sort: "price_desc" });
    expect(desc.body.data.map((p: { price: number }) => p.price)).toEqual([1500, 400, 300]);

    const inStock = await testAgent().get("/api/v1/shop/products").query({ inStock: "true" });
    expect(inStock.body.data).toHaveLength(2);

    const page = await testAgent().get("/api/v1/shop/products").query({ sort: "price_asc", page: 2, pageSize: 2 });
    expect(page.body.data).toHaveLength(1);
    expect(page.body.meta).toMatchObject({ page: 2, pageSize: 2, total: 3, totalPages: 2 });
  });

  it("treats LIKE wildcards in search as literal text", async () => {
    const cat = await seedShopCategory();
    await seedShopProduct(cat.id, { name: "Plain Product" });
    const res = await testAgent().get("/api/v1/shop/products").query({ search: "%" });
    expect(res.body.data).toHaveLength(0);
  });

  it("derives discount %, stock status and a server-side max order quantity", async () => {
    const cat = await seedShopCategory();
    const p = await seedShopProduct(cat.id, { price: 750, mrp: 1000, stock: 3 });
    const out = await seedShopProduct(cat.id, { stock: 0 });
    const detail = await testAgent().get(`/api/v1/shop/products/${p.slug}`);
    expect(detail.body.data.product).toMatchObject({ price: 750, mrp: 1000, discountPercent: 25, stockStatus: "low_stock", maxOrderQuantity: 3 });
    const outDetail = await testAgent().get(`/api/v1/shop/products/${out.slug}`);
    expect(outDetail.body.data.product).toMatchObject({ stockStatus: "out_of_stock", inStock: false, maxOrderQuantity: 0 });
  });

  it("returns related products from the same category only", async () => {
    const a = await seedShopCategory();
    const b = await seedShopCategory();
    const main = await seedShopProduct(a.id);
    const sibling = await seedShopProduct(a.id);
    await seedShopProduct(b.id);
    const res = await testAgent().get(`/api/v1/shop/products/${main.slug}`);
    expect(res.body.data.related.map((r: { id: string }) => r.id)).toEqual([sibling.id]);
  });

  it("feeds the sitemap with published products only", async () => {
    const cat = await seedShopCategory();
    const live = await seedShopProduct(cat.id);
    await seedShopProduct(cat.id, { status: "draft" });
    await seedShopProduct(cat.id, { active: false });
    const res = await testAgent().get("/api/v1/shop/sitemap-data");
    expect(res.body.data.products.map((p: { slug: string }) => p.slug)).toEqual([live.slug]);
  });
});

describe("shop catalogue — admin", () => {
  const adminToken = mintToken({ role: "admin" });
  const customerToken = mintToken({ role: "customer" });
  const providerToken = mintToken({ role: "provider" });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("requires an authenticated admin for every admin route", async () => {
    const id = randomUUID();
    const routes: Array<[string, string]> = [
      ["get", "/api/v1/admin/shop/products"],
      ["post", "/api/v1/admin/shop/products"],
      ["patch", `/api/v1/admin/shop/products/${id}`],
      ["delete", `/api/v1/admin/shop/products/${id}`],
      ["get", "/api/v1/admin/shop/categories"],
      ["post", "/api/v1/admin/shop/categories"],
      ["get", "/api/v1/admin/shop/orders"],
      ["patch", `/api/v1/admin/shop/orders/${id}/status`],
      ["get", "/api/v1/admin/shop/settings"],
      ["post", "/api/v1/admin/shop/seed-demo"],
    ];
    for (const [method, url] of routes) {
      const anon = await (testAgent() as unknown as Record<string, (u: string) => Promise<{ status: number }>>)[method]!(url);
      expect(anon.status).toBe(401);
      for (const token of [customerToken, providerToken]) {
        const res = await (testAgent() as unknown as Record<string, (u: string) => { set: (k: string, v: string) => Promise<{ status: number }> }>)[method]!(url).set("Authorization", bearer(token));
        expect(res.status).toBe(403);
      }
    }
  });

  it("creates, edits, deactivates and deletes a category; blocks deleting a non-empty one", async () => {
    const agent = () => testAgent();
    const created = await agent().post("/api/v1/admin/shop/categories").set("Authorization", bearer(adminToken)).send({ name: "Cleaning Products" });
    expect(created.status).toBe(201);
    expect(created.body.data.slug).toBe("cleaning-products");

    const dup = await agent().post("/api/v1/admin/shop/categories").set("Authorization", bearer(adminToken)).send({ name: "x", slug: "cleaning-products" });
    expect(dup.status).toBe(409);

    const id = created.body.data.id as string;
    const patched = await agent().patch(`/api/v1/admin/shop/categories/${id}`).set("Authorization", bearer(adminToken)).send({ active: false, name: "Cleaning" });
    expect(patched.body.data).toMatchObject({ active: false, name: "Cleaning" });

    await seedShopProduct(id);
    const blocked = await agent().delete(`/api/v1/admin/shop/categories/${id}`).set("Authorization", bearer(adminToken));
    expect(blocked.status).toBe(409);

    const empty = await seedShopCategory();
    const ok = await agent().delete(`/api/v1/admin/shop/categories/${empty.id}`).set("Authorization", bearer(adminToken));
    expect(ok.status).toBe(200);
  });

  it("reorders categories", async () => {
    const a = await seedShopCategory({ name: "A" });
    const b = await seedShopCategory({ name: "B" });
    const c = await seedShopCategory({ name: "C" });
    const res = await testAgent().post("/api/v1/admin/shop/categories/reorder").set("Authorization", bearer(adminToken)).send({ orderedIds: [c.id, a.id, b.id] });
    expect(res.body.data.map((x: { name: string }) => x.name)).toEqual(["C", "A", "B"]);
  });

  it("creates a product as a draft by default and publishes/unpublishes/deactivates it", async () => {
    const cat = await seedShopCategory();
    const create = await testAgent()
      .post("/api/v1/admin/shop/products")
      .set("Authorization", bearer(adminToken))
      .send({ categoryId: cat.id, name: "New Filter", sku: "NF-1", price: 499.5, mrp: 650, stockQuantity: 12, specifications: [{ label: "Type", value: "Sediment" }] });
    expect(create.status).toBe(201);
    expect(create.body.data).toMatchObject({ status: "draft", active: true, price: 499.5, slug: "new-filter" });
    const id = create.body.data.id as string;
    expect((await testAgent().get("/api/v1/shop/products/new-filter")).status).toBe(404);

    await testAgent().patch(`/api/v1/admin/shop/products/${id}`).set("Authorization", bearer(adminToken)).send({ status: "published" });
    expect((await testAgent().get("/api/v1/shop/products/new-filter")).status).toBe(200);

    await testAgent().patch(`/api/v1/admin/shop/products/${id}`).set("Authorization", bearer(adminToken)).send({ active: false });
    expect((await testAgent().get("/api/v1/shop/products/new-filter")).status).toBe(404);

    await testAgent().patch(`/api/v1/admin/shop/products/${id}`).set("Authorization", bearer(adminToken)).send({ active: true, status: "draft" });
    expect((await testAgent().get("/api/v1/shop/products/new-filter")).status).toBe(404);

    const del = await testAgent().delete(`/api/v1/admin/shop/products/${id}`).set("Authorization", bearer(adminToken));
    expect(del.status).toBe(200);
    expect((await testAgent().get(`/api/v1/admin/shop/products/${id}`).set("Authorization", bearer(adminToken))).status).toBe(404);
  });

  it("validates prices, MRP, stock and SKU", async () => {
    const cat = await seedShopCategory();
    const base = { categoryId: cat.id, name: "P", sku: "OK-1", price: 100, stockQuantity: 1 };
    const post = (body: object) => testAgent().post("/api/v1/admin/shop/products").set("Authorization", bearer(adminToken)).send(body);

    expect((await post({ ...base, price: 0 })).status).toBe(400);
    expect((await post({ ...base, price: -5 })).status).toBe(400);
    expect((await post({ ...base, price: 10.123 })).status).toBe(400);
    expect((await post({ ...base, price: "100" })).status).toBe(400);
    expect((await post({ ...base, mrp: 50 })).status).toBe(400);
    expect((await post({ ...base, stockQuantity: -1 })).status).toBe(400);
    expect((await post({ ...base, stockQuantity: 1.5 })).status).toBe(400);
    expect((await post({ ...base, sku: "bad sku!" })).status).toBe(400);
    expect((await post({ ...base, categoryId: randomUUID() })).status).toBe(400);

    expect((await post(base)).status).toBe(201);
    expect((await post({ ...base, name: "Q" })).status).toBe(409); // duplicate SKU

    // MRP vs stored price is enforced on partial updates too.
    const list = await testAgent().get("/api/v1/admin/shop/products").set("Authorization", bearer(adminToken));
    const id = list.body.data[0].id as string;
    const bad = await testAgent().patch(`/api/v1/admin/shop/products/${id}`).set("Authorization", bearer(adminToken)).send({ mrp: 50 });
    expect(bad.status).toBe(400);
  });

  it("adjusts stock atomically and refuses to go below zero", async () => {
    const cat = await seedShopCategory();
    const p = await seedShopProduct(cat.id, { stock: 5 });
    const url = `/api/v1/admin/shop/products/${p.id}/stock`;
    const add = await testAgent().post(url).set("Authorization", bearer(adminToken)).send({ delta: 10 });
    expect(add.body.data.stockQuantity).toBe(15);
    const set = await testAgent().post(url).set("Authorization", bearer(adminToken)).send({ stockQuantity: 2 });
    expect(set.body.data.stockQuantity).toBe(2);
    const under = await testAgent().post(url).set("Authorization", bearer(adminToken)).send({ delta: -3 });
    expect(under.status).toBe(400);
    expect((await testAgent().get(`/api/v1/admin/shop/products/${p.id}`).set("Authorization", bearer(adminToken))).body.data.stockQuantity).toBe(2);
  });

  it("lists low-stock products for the admin", async () => {
    const cat = await seedShopCategory();
    await seedShopProduct(cat.id, { name: "Plenty", stock: 50 });
    await seedShopProduct(cat.id, { name: "Low", stock: 2 });
    const res = await testAgent().get("/api/v1/admin/shop/products").query({ lowStock: "true" }).set("Authorization", bearer(adminToken));
    expect(res.body.data.map((p: { name: string }) => p.name)).toEqual(["Low"]);
  });

  it("attaches up to 6 library images with a primary, rejects non-images/inactive/duplicates", async () => {
    const cat = await seedShopCategory();
    const p = await seedShopProduct(cat.id);
    const img1 = await seedMedia("image");
    const img2 = await seedMedia("image");
    const vid = await seedMedia("video");
    const inactive = await seedMedia("image", false);
    const put = (images: object[]) => testAgent().put(`/api/v1/admin/shop/products/${p.id}/images`).set("Authorization", bearer(adminToken)).send({ images });

    const ok = await put([{ mediaId: img1 }, { mediaId: img2, isPrimary: true, altText: "Side view" }]);
    expect(ok.status).toBe(200);
    expect(ok.body.data.images.map((i: { mediaId: string; isPrimary: boolean }) => [i.mediaId, i.isPrimary])).toEqual([[img1, false], [img2, true]]);

    const pub = await testAgent().get(`/api/v1/shop/products/${p.slug}`);
    expect(pub.body.data.product.primaryImage.url).toContain(img2);

    expect((await put([{ mediaId: vid }])).status).toBe(400);
    expect((await put([{ mediaId: inactive }])).status).toBe(400);
    expect((await put([{ mediaId: img1 }, { mediaId: img1 }])).status).toBe(400);
    expect((await put([{ mediaId: randomUUID() }])).status).toBe(400);
    const seven = await Promise.all(Array.from({ length: 7 }, () => seedMedia("image")));
    expect((await put(seven.map((mediaId) => ({ mediaId })))).status).toBe(400);
  });

  it("protects media that a shop product uses from deletion via the Media Library references", async () => {
    const cat = await seedShopCategory();
    const p = await seedShopProduct(cat.id);
    const img = await seedMedia("image");
    await testAgent().put(`/api/v1/admin/shop/products/${p.id}/images`).set("Authorization", bearer(adminToken)).send({ images: [{ mediaId: img }] });
    const del = await testAgent().delete(`/api/v1/admin/media-library/${img}`).set("Authorization", bearer(adminToken));
    expect(del.status).toBe(409);
  });

  it("validates YouTube links and uploaded videos", async () => {
    const cat = await seedShopCategory();
    const p = await seedShopProduct(cat.id);
    const vid = await seedMedia("video");
    const img = await seedMedia("image");
    const put = (videos: object[]) => testAgent().put(`/api/v1/admin/shop/products/${p.id}/videos`).set("Authorization", bearer(adminToken)).send({ videos });

    const ok = await put([{ kind: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "How to install" }, { kind: "upload", mediaId: vid }]);
    expect(ok.status).toBe(200);
    expect(ok.body.data.videos[0]).toMatchObject({ kind: "youtube", youtubeId: "dQw4w9WgXcQ", embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" });
    expect(ok.body.data.videos[1]).toMatchObject({ kind: "upload", mediaId: vid });

    expect((await put([{ kind: "youtube", url: "https://evil.example.com/watch?v=dQw4w9WgXcQ" }])).status).toBe(400);
    expect((await put([{ kind: "youtube", url: "javascript:alert(1)" }])).status).toBe(400);
    expect((await put([{ kind: "upload", mediaId: img }])).status).toBe(400);
  });

  it("parses the supported YouTube URL shapes", () => {
    expect(parseYouTubeId("https://youtu.be/dQw4w9WgXcQ?t=5")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=x")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(parseYouTubeId("https://notyoutube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseYouTubeId("not a url")).toBeNull();
  });

  it("falls back to the admin-configured delivery/return text and exposes public delivery settings", async () => {
    const cat = await seedShopCategory();
    const p = await seedShopProduct(cat.id);
    await testAgent()
      .put("/api/v1/admin/shop/settings")
      .set("Authorization", bearer(adminToken))
      .send({ deliveryCharge: 49, freeDeliveryThreshold: 999, defaultDeliveryInfo: "Ships in 3-5 days.", defaultReturnInfo: "Return policy set by admin." });
    const detail = await testAgent().get(`/api/v1/shop/products/${p.slug}`);
    expect(detail.body.data.product).toMatchObject({ deliveryInfo: "Ships in 3-5 days.", returnInfo: "Return policy set by admin." });
    const pub = await testAgent().get("/api/v1/shop/settings/public");
    expect(pub.body.data).toEqual({ deliveryCharge: 49, freeDeliveryThreshold: 999 });
    expect((await testAgent().put("/api/v1/admin/shop/settings").set("Authorization", bearer(adminToken)).send({ deliveryCharge: -1 })).status).toBe(400);
  });

  it("seeds sample data idempotently, with no 'Demo' wording in names or descriptions", async () => {
    const first = await testAgent().post("/api/v1/admin/shop/seed-demo").set("Authorization", bearer(adminToken));
    expect(first.status).toBe(200);
    expect(first.body.data.productsCreated).toBeGreaterThan(10);
    const second = await testAgent().post("/api/v1/admin/shop/seed-demo").set("Authorization", bearer(adminToken));
    expect(second.body.data).toEqual({ categoriesCreated: 0, productsCreated: 0 });
    const list = await testAgent().get("/api/v1/shop/products").query({ pageSize: 100 });
    expect(list.body.data.every((p: { isDemo: boolean }) => p.isDemo)).toBe(true);
    // The internal flag stays (it enables the placeholder image) but no seeded text may say "demo".
    const texts = list.body.data.flatMap((p: { name: string; shortDescription: string | null; description?: string | null; category: { name: string; description?: string | null } }) => [
      p.name,
      p.shortDescription ?? "",
      p.description ?? "",
      p.category.name,
      p.category.description ?? "",
    ]);
    expect(texts.filter((t: string) => /demo/i.test(t))).toEqual([]);
    const cats = await testAgent().get("/api/v1/shop/categories");
    expect(JSON.stringify(cats.body.data)).not.toMatch(/demo/i);
  });
});
