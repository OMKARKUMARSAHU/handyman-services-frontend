import { randomUUID } from "node:crypto";
import { getDb } from "../../database/db";
import { NotFoundError } from "../../shared/errors";
import { type CategoryDto, type CategoryRow, toCategoryDto } from "./categories.types";

const TABLE = "categories";

export async function listCategories(): Promise<CategoryDto[]> {
  const rows = await getDb()<CategoryRow>(TABLE).where({ active: true }).orderBy("sort_order", "asc");
  return rows.map(toCategoryDto);
}

export async function getCategoryBySlug(slug: string): Promise<CategoryDto | null> {
  const row = await getDb()<CategoryRow>(TABLE).where({ slug }).first();
  return row ? toCategoryDto(row) : null;
}

export async function getCategoryById(id: string): Promise<CategoryDto | null> {
  const row = await getDb()<CategoryRow>(TABLE).where({ id }).first();
  return row ? toCategoryDto(row) : null;
}

export interface UpsertCategoryInput {
  slug: string;
  name: string;
  description: string;
  icon: string;
  image?: string | null;
  sortOrder?: number;
  active?: boolean;
}

export async function createCategory(input: UpsertCategoryInput): Promise<CategoryDto> {
  const id = randomUUID();
  await getDb()<CategoryRow>(TABLE).insert({
    id,
    slug: input.slug,
    name: input.name,
    description: input.description,
    icon: input.icon,
    image: input.image ?? null,
    sort_order: input.sortOrder ?? 0,
    active: input.active ?? true,
  });
  const created = await getCategoryById(id);
  if (!created) throw new Error("Failed to read back created category.");
  return created;
}

export async function updateCategory(id: string, input: Partial<UpsertCategoryInput>): Promise<CategoryDto> {
  const existing = await getCategoryById(id);
  if (!existing) throw new NotFoundError("Category not found.");

  const patch: Partial<CategoryRow> = {};
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.image !== undefined) patch.image = input.image;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  if (input.active !== undefined) patch.active = input.active;

  if (Object.keys(patch).length > 0) {
    await getDb()<CategoryRow>(TABLE).where({ id }).update(patch);
  }
  const updated = await getCategoryById(id);
  if (!updated) throw new Error("Failed to read back updated category.");
  return updated;
}
