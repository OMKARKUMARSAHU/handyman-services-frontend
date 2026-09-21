import type { Category, Product, Service } from "@/types";
import { getCategories } from "./categories";
import { getAllProductsSync } from "./products";
import { getAllServicesSync } from "./services";

/**
 * Client-side substring search across categories/products/services, extending
 * the existing SearchBox filter logic (previously just categories/appliances)
 * to the larger marketplace entity set — PHASE_2_SYSTEM_ARCHITECTURE.md §8.
 * A real backend could add ranking/typo-tolerance behind this same signature
 * without SearchBox changing.
 */
export async function searchCatalog(
  query: string,
  opts?: { cityId?: string }
): Promise<{ categories: Category[]; products: Product[]; services: Service[] }> {
  const q = query.trim().toLowerCase();
  if (!q) return { categories: [], products: [], services: [] };

  const categories = getCategories().filter((c) => c.name.toLowerCase().includes(q));
  const products = getAllProductsSync().filter((p) => p.name.toLowerCase().includes(q));

  let services = getAllServicesSync().filter((s) => s.name.toLowerCase().includes(q));
  if (opts?.cityId) {
    const cityId = opts.cityId;
    services = services.filter((s) => s.availableCityIds.includes(cityId));
  }

  return { categories, products, services };
}
