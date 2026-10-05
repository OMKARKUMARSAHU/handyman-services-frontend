import { randomUUID } from "node:crypto";
import { getDb } from "../../database/db";
import { NotFoundError } from "../../shared/errors";
import { type ProductDto, type ProductRow, toProductDto } from "./products.types";

const TABLE = "products";

/** `includeInactive` -- see the identical doc comment on `listCities()`. */
export async function listProductsByCategorySlug(
  categorySlug: string,
  opts: { includeInactive?: boolean } = {}
): Promise<ProductDto[]> {
  let query = getDb()<ProductRow>(TABLE)
    .join("categories", "categories.id", `${TABLE}.category_id`)
    .where("categories.slug", categorySlug);
  if (!opts.includeInactive) query = query.andWhere(`${TABLE}.active`, true);
  const rows = await query.select(`${TABLE}.*`).orderBy(`${TABLE}.sort_order`, "asc");
  return rows.map(toProductDto);
}

export async function getProductBySlugs(categorySlug: string, productSlug: string): Promise<ProductDto | null> {
  const row = await getDb()<ProductRow>(TABLE)
    .join("categories", "categories.id", `${TABLE}.category_id`)
    .where("categories.slug", categorySlug)
    .andWhere(`${TABLE}.slug`, productSlug)
    .select(`${TABLE}.*`)
    .first();
  return row ? toProductDto(row) : null;
}

export async function getProductById(id: string): Promise<ProductDto | null> {
  const row = await getDb()<ProductRow>(TABLE).where({ id }).first();
  return row ? toProductDto(row) : null;
}

export interface UpsertProductInput {
  categoryId: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  image?: string | null;
  sortOrder?: number;
  active?: boolean;
}

export async function createProduct(input: UpsertProductInput): Promise<ProductDto> {
  const id = randomUUID();
  await getDb()<ProductRow>(TABLE).insert({
    id,
    category_id: input.categoryId,
    slug: input.slug,
    name: input.name,
    description: input.description,
    icon: input.icon,
    image: input.image ?? null,
    sort_order: input.sortOrder ?? 0,
    active: input.active ?? true,
  });
  const created = await getProductById(id);
  if (!created) throw new Error("Failed to read back created product.");
  return created;
}

export async function updateProduct(id: string, input: Partial<UpsertProductInput>): Promise<ProductDto> {
  const existing = await getProductById(id);
  if (!existing) throw new NotFoundError("Product not found.");

  const patch: Partial<ProductRow> = {};
  if (input.categoryId !== undefined) patch.category_id = input.categoryId;
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.image !== undefined) patch.image = input.image;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  if (input.active !== undefined) patch.active = input.active;

  if (Object.keys(patch).length > 0) {
    await getDb()<ProductRow>(TABLE).where({ id }).update(patch);
  }
  const updated = await getProductById(id);
  if (!updated) throw new Error("Failed to read back updated product.");
  return updated;
}
