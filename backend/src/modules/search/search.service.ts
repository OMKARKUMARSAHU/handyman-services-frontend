import { getDb } from "../../database/db";
import { toCategoryDto, type CategoryDto, type CategoryRow } from "../categories/categories.types";
import { toProductDto, type ProductDto, type ProductRow } from "../products/products.types";
import { listServicesPublic } from "../services/services.service";
import type { PublicServiceDto } from "../services/services.types";

/**
 * Server-side port of the existing frontend's client-side `searchCatalog()`
 * (src/lib/data/search.ts) — same signature, same case-insensitive substring
 * match on `name`, same three-entity shape — now backed by the real DB
 * instead of the in-memory mock, and enforcing the same approved+active
 * visibility rule every other public catalog query enforces.
 */
export async function searchCatalog(
  q: string,
  cityId?: string
): Promise<{ categories: CategoryDto[]; products: ProductDto[]; services: PublicServiceDto[] }> {
  const term = q.trim();
  if (!term) return { categories: [], products: [], services: [] };

  const db = getDb();
  const categoryRows = await db<CategoryRow>("categories")
    .where({ active: true })
    .andWhere((b) => b.whereILike("name", `%${term}%`))
    .orderBy("sort_order", "asc");

  const productRows = await db<ProductRow>("products")
    .where({ active: true })
    .andWhere((b) => b.whereILike("name", `%${term}%`))
    .orderBy("sort_order", "asc");

  const { items: services } = await listServicesPublic({ q: term, cityId }, { page: 1, pageSize: 50 });

  return {
    categories: categoryRows.map(toCategoryDto),
    products: productRows.map(toProductDto),
    services,
  };
}
