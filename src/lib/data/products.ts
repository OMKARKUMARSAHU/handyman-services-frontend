import productsData from "@/data/products.json";
import type { Product } from "@/types";

/**
 * Product reads (renamed conceptually from `Appliance` —
 * PHASE_2_DATA_ARCHITECTURE.md §3). The legacy `src/lib/data/appliances.ts`
 * module is left untouched and still backs the pre-existing `/services/[category]`
 * route; this module is the marketplace-facing equivalent used by the new
 * City → Category → Product hierarchy.
 */
export async function getProductsByCategory(categoryId: string): Promise<Product[]> {
  return (productsData as Product[])
    .filter((p) => p.categoryId === categoryId && p.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getProductBySlug(
  categorySlug: string,
  productSlug: string
): Promise<Product | null> {
  const product = (productsData as Product[]).find(
    (p) => p.categoryId === categorySlug && p.slug === productSlug && p.active
  );
  return product ?? null;
}

export function getAllProductsSync(): Product[] {
  return [...(productsData as Product[])].filter((p) => p.active);
}

export function getProductBySlugSync(categorySlug: string, productSlug: string): Product | undefined {
  return (productsData as Product[]).find(
    (p) => p.categoryId === categorySlug && p.slug === productSlug && p.active
  );
}
