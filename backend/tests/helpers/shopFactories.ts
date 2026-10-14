import { randomUUID } from "node:crypto";
import { getDb } from "../../src/database/db";
import { createShopCategory } from "../../src/modules/shop/shopCategories.service";
import { createShopProduct } from "../../src/modules/shop/shopProducts.service";
import { findOrCreateCustomerBySub } from "../../src/modules/customers/customers.service";
import { createOwnAddress } from "../../src/modules/customers/addresses.service";

export async function seedShopCategory(overrides: { name?: string; active?: boolean } = {}) {
  const unique = randomUUID().slice(0, 8);
  return createShopCategory({ name: overrides.name ?? `Test Category ${unique}`, active: overrides.active ?? true });
}

export async function seedShopProduct(
  categoryId: string,
  overrides: Partial<{ name: string; price: number; mrp: number | null; stock: number; status: "draft" | "published"; active: boolean; track: boolean; sku: string; featured: boolean }> = {}
) {
  const unique = randomUUID().slice(0, 8);
  return createShopProduct({
    categoryId,
    name: overrides.name ?? `Test Product ${unique}`,
    sku: overrides.sku ?? `SKU-${unique}`,
    price: overrides.price ?? 100,
    mrp: overrides.mrp ?? null,
    stockQuantity: overrides.stock ?? 10,
    status: overrides.status ?? "published",
    active: overrides.active ?? true,
    trackInventory: overrides.track ?? true,
    featured: overrides.featured ?? false,
  });
}

/** A customer + one saved address; returns ids and the token subject. */
export async function seedCustomerWithAddress(sub: string = randomUUID()) {
  const customer = await findOrCreateCustomerBySub(sub, { name: "Test Buyer", email: `${sub.slice(0, 8)}@example.com` });
  const address = await createOwnAddress(customer.id, { label: "Home", line1: "221B Test Lane", city: "Testville", state: "TS", pincode: "560001" });
  return { customer, address, sub };
}

export async function seedMedia(type: "image" | "video" = "image", active = true) {
  const id = randomUUID();
  await getDb()("media").insert({
    id,
    type,
    s3_key: `shop-tests/${id}`,
    url: `/api/v1/media-library/file/${id}`,
    mime_type: type === "image" ? "image/jpeg" : "video/mp4",
    original_filename: `${id}.${type === "image" ? "jpg" : "mp4"}`,
    file_size_bytes: 1000,
    active,
  });
  return id;
}

/** An active city row (cities are a pre-existing table; the shop only references them). */
export async function seedShopCity(name = `City ${randomUUID().slice(0, 6)}`) {
  const id = randomUUID();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  await getDb()("cities").insert({ id, name, state: "Test State", slug, is_popular: false, active: true, sort_order: 0 });
  return { id, name, slug };
}
