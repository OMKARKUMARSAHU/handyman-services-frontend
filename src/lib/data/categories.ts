import categoriesData from "@/data/categories.json";
import type { Category } from "@/types";

export function getCategories(): Category[] {
  return [...(categoriesData as Category[])].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
}

export function getCategoryById(id: string): Category | undefined {
  return (categoriesData as Category[]).find((category) => category.id === id);
}
