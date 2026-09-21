import type { Category } from "@/types";
import { Container } from "@/components/ui/Container";
import { CategoryCard } from "./CategoryCard";

/**
 * Phase 3 final-polish pass (item 1): the grid used to go up to
 * `lg:grid-cols-5`, which made sense for a larger catalog but — with only
 * the 3 categories currently in `categories.json` (client's confirmed
 * category count today) — left 2 of 5 columns empty on desktop, reading as
 * unfinished/unbalanced rather than an intentional 3-card layout. Capped at
 * 3 columns and the row itself is width-constrained and centered (instead
 * of stretching to the full `Container`), so 3 cards read as a deliberate
 * composition at any desktop width. Mobile (`grid-cols-2`) is unchanged.
 * No categories were added to fill space — this is a layout-only fix, and
 * the grid still scales cleanly if more categories are added later.
 */
export function CategoryGrid({ categories, citySlug }: { categories: Category[]; citySlug?: string }) {
  return (
    <Container>
      <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6">
        {categories.map((category) => (
          <CategoryCard key={category.id} category={category} citySlug={citySlug} />
        ))}
      </div>
    </Container>
  );
}
