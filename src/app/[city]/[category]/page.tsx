import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllCitiesSync, getCityBySlugSync } from "@/lib/data/cities";
import { getCategoryById, getCategories } from "@/lib/data/categories";
import { getAllProductsSync } from "@/lib/data/products";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { ProductGrid } from "@/components/catalog/ProductGrid";

export function generateStaticParams() {
  const cities = getAllCitiesSync();
  const categories = getCategories();
  return cities.flatMap((city) => categories.map((category) => ({ city: city.slug, category: category.id })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; category: string }>;
}): Promise<Metadata> {
  const { city: citySlug, category: categoryId } = await params;
  const city = getCityBySlugSync(citySlug);
  const category = getCategoryById(categoryId);
  if (!city || !category) return {};
  return {
    title: `${category.name} in ${city.name}`,
    description: `${category.description} Available in ${city.name}.`,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ city: string; category: string }>;
}) {
  const { city: citySlug, category: categoryId } = await params;
  const city = getCityBySlugSync(citySlug);
  const category = getCategoryById(categoryId);
  if (!city || !category) notFound();

  const products = getAllProductsSync().filter((p) => p.categoryId === category.id);

  return (
    <>
      <PageHeader heading={`${category.name} in ${city.name}`} subheading={category.description} />
      <section className="py-10 sm:py-14">
        <Container>
          {/*
            Accessibility fix (Phase 4 QA): PageHeader renders an <h1>, and
            ProductCard's title is an <h3> — with nothing in between, that
            was a skipped heading level (axe "heading-order"). This sr-only
            <h2> restores a correct 1→2→3 outline without changing anything
            visible.
          */}
          <h2 className="sr-only">Products in {category.name}</h2>
          <ProductGrid products={products} citySlug={city.slug} />
        </Container>
      </section>
    </>
  );
}
