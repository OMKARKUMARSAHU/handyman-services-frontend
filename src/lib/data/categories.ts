import categoriesData from "@/data/categories.json";
import type { Category } from "@/types";

/**
 * Category reads. The 3 categories here (and the products/services under
 * them) are Phase 3's illustrative mock catalog, not a client-confirmed
 * final catalog (Phase 3 final-polish pass, item 3 — see also
 * `services.ts`'s pricing note). The data-driven read pattern is unchanged
 * either way: swapping in a confirmed catalog later is a data-file change,
 * not a code change.
 */
export function getCategories(): Category[] {
  return [...(categoriesData as Category[])].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
}

export function getCategoryById(id: string): Category | undefined {
  return (categoriesData as Category[]).find((category) => category.id === id);
}
