import { randomUUID } from "node:crypto";
import { getDb } from "../../database/db";
import { ConflictError, NotFoundError } from "../../shared/errors";
import type { ShopCategoryDto, ShopCategoryRow } from "./shop.types";

const TABLE = "shop_categories";

export function slugify(input: string, max = 120): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return slug || "item";
}

/** Returns `base`, or `base-2`, `base-3`… so the slug is unique within `table`. */
export async function uniqueSlug(table: string, base: string, ignoreId?: string, max = 120): Promise<string> {
  const db = getDb();
  let candidate = base.slice(0, max);
  for (let i = 2; i < 500; i++) {
    const q = db(table).where({ slug: candidate });
    if (ignoreId) q.whereNot({ id: ignoreId });
    const exists = await q.first("id");
    if (!exists) return candidate;
    const suffix = `-${i}`;
    candidate = `${base.slice(0, max - suffix.length)}${suffix}`;
  }
  throw new ConflictError("Could not generate a unique slug; please provide one.");
}

function toDto(row: ShopCategoryRow, productCount: number): ShopCategoryDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
    active: Boolean(row.active),
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    productCount,
  };
}

async function countsByCategory(publicOnly: boolean): Promise<Map<string, number>> {
  const q = getDb()("shop_products").select("category_id").count({ n: "id" }).groupBy("category_id");
  if (publicOnly) q.where({ status: "published", active: true });
  const rows = (await q) as unknown as Array<{ category_id: string; n: number | string }>;
  return new Map(rows.map((r) => [r.category_id, Number(r.n)]));
}

/** Public: active categories only, with the count of publicly visible products. */
export async function listPublicShopCategories(): Promise<ShopCategoryDto[]> {
  const rows: ShopCategoryRow[] = await getDb()(TABLE).where({ active: true }).orderBy([{ column: "sort_order" }, { column: "name" }]);
  const counts = await countsByCategory(true);
  return rows.map((r) => toDto(r, counts.get(r.id) ?? 0));
}

/** Admin: every category (active or not) with the total product count. */
export async function listAdminShopCategories(): Promise<ShopCategoryDto[]> {
  const rows: ShopCategoryRow[] = await getDb()(TABLE).orderBy([{ column: "sort_order" }, { column: "name" }]);
  const counts = await countsByCategory(false);
  return rows.map((r) => toDto(r, counts.get(r.id) ?? 0));
}

export async function getShopCategoryById(id: string): Promise<ShopCategoryRow> {
  const row: ShopCategoryRow | undefined = await getDb()(TABLE).where({ id }).first();
  if (!row) throw new NotFoundError("Shop category not found.");
  return row;
}

export interface ShopCategoryInput {
  name?: string;
  slug?: string;
  description?: string | null;
  imageUrl?: string | null;
  sortOrder?: number;
  active?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export async function createShopCategory(input: ShopCategoryInput & { name: string }): Promise<ShopCategoryDto> {
  const db = getDb();
  const slug = input.slug ?? (await uniqueSlug(TABLE, slugify(input.name)));
  if (input.slug) {
    const clash = await db(TABLE).where({ slug }).first("id");
    if (clash) throw new ConflictError(`A shop category with the slug "${slug}" already exists.`);
  }
  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const max = await db(TABLE).max({ m: "sort_order" }).first();
    sortOrder = Number((max as { m: number | null } | undefined)?.m ?? -1) + 1;
  }
  const id = randomUUID();
  await db(TABLE).insert({
    id,
    slug,
    name: input.name,
    description: input.description ?? null,
    image_url: input.imageUrl ?? null,
    sort_order: sortOrder,
    active: input.active ?? true,
    seo_title: input.seoTitle ?? null,
    seo_description: input.seoDescription ?? null,
  });
  return toDto(await getShopCategoryById(id), 0);
}

export async function updateShopCategory(id: string, input: ShopCategoryInput): Promise<ShopCategoryDto> {
  const existing = await getShopCategoryById(id);
  const db = getDb();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.slug !== undefined && input.slug !== existing.slug) {
    const clash = await db(TABLE).where({ slug: input.slug }).whereNot({ id }).first("id");
    if (clash) throw new ConflictError(`A shop category with the slug "${input.slug}" already exists.`);
    patch.slug = input.slug;
  }
  if (input.description !== undefined) patch.description = input.description;
  if (input.imageUrl !== undefined) patch.image_url = input.imageUrl;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  if (input.active !== undefined) patch.active = input.active;
  if (input.seoTitle !== undefined) patch.seo_title = input.seoTitle;
  if (input.seoDescription !== undefined) patch.seo_description = input.seoDescription;
  if (Object.keys(patch).length > 0) await db(TABLE).where({ id }).update(patch);

  const counts = await countsByCategory(false);
  return toDto(await getShopCategoryById(id), counts.get(id) ?? 0);
}

export async function reorderShopCategories(orderedIds: string[]): Promise<ShopCategoryDto[]> {
  const db = getDb();
  const found: Array<{ id: string }> = await db(TABLE).whereIn("id", orderedIds).select("id");
  if (found.length !== new Set(orderedIds).size) throw new NotFoundError("One or more shop categories were not found.");
  await db.transaction(async (trx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await trx(TABLE).where({ id: orderedIds[i]! }).update({ sort_order: i });
    }
  });
  return listAdminShopCategories();
}

/**
 * Hard-delete is only allowed for an EMPTY category. A category that still has
 * products is never silently emptied or cascaded — the admin must move/delete
 * the products or simply deactivate the category (which hides it and its
 * products from the public site without losing anything).
 */
export async function deleteShopCategory(id: string): Promise<void> {
  await getShopCategoryById(id);
  const row = (await getDb()("shop_products").where({ category_id: id }).count({ n: "id" }).first()) as { n: number | string } | undefined;
  const n = Number(row?.n ?? 0);
  if (n > 0) {
    throw new ConflictError(
      `This category still has ${n} product(s). Move or delete them first, or deactivate the category instead.`,
      { productCount: n }
    );
  }
  await getDb()(TABLE).where({ id }).delete();
}
