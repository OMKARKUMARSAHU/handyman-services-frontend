import type { Category } from "@/types";
import { Container } from "@/components/ui/Container";
import { CategoryCard } from "./CategoryCard";

export function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <Container>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {categories.map((category) => (
          <CategoryCard key={category.id} category={category} />
        ))}
      </div>
    </Container>
  );
}
