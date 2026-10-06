import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCityBySlugSync } from "@/lib/data/cities";
import { getCategoryById } from "@/lib/data/categories";
import { getCategoriesLive, getAllProductsLive } from "@/lib/data/live";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { ProductGrid } from "@/components/catalog/ProductGrid";

/**
 * BUILD-TIME FIX (Vercel build timeout -- "took more than 60 seconds ...
 * after 3 attempts ... Next.js build worker exited with code: 1"): this
 * previously returned every city x category combination, forcing
 * `next build` to eagerly render every `/[city]/[category]` page right
 * now by calling this page's body -- which fetches live categories +
 * products from the backend via `@/lib/data/live` -- once per
 * combination, synchronously, during the build. If the backend is slow,
 * cold, or unreachable from Vercel's build network at that moment, a
 * render can hang past Next's internal per-page budget, and after 3
 * retries Next kills the build.
 *
 * Returning an empty array means `next build` pre-renders ZERO
 * `/[city]/[category]` pages -- no backend calls happen at build time,
 * so the build can never fail because of backend latency/unavailability
 * again. `dynamicParams` below (default `true`, made explicit so this
 * can't silently regress) is what keeps every `/[city]/[category]` URL
 * working exactly as before: the first visitor to any combination
 * renders it on demand (full server-rendered HTML, same
 * `generateMetadata` above, same live-data fetch, same mock fallback),
 * and Next then caches that render per the `revalidate: 30` already set
 * on every call in `@/lib/data/live` -- this is Incremental Static
 * Regeneration seeded at request time instead of enumerated at build
 * time, not a switch to client-side or uncached rendering.
 */
export function generateStaticParams() {
  return [];
}

export const dynamicParams = true;

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

/**
 * AUDIT FOLLOW-UP ("Admin CMS/content-management pipeline" -- "real
 * product photos, not icons"): category + product reads now go through
 * `@/lib/data/live` (falling back to mock if the backend is unreachable),
 * so an Admin-uploaded category/product photo and any newly added product
 * show up here without a code change -- the same pattern already used on
 * the homepage. `generateStaticParams`/`generateMetadata` above stay on
 * the mock readers (build-time path seeding only; unreachable at request
 * time anyway), matching every other page in this audit.
 */
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ city: string; category: string }>;
}) {
  const { city: citySlug, category: categoryId } = await params;
  const city = getCityBySlugSync(citySlug);
  const [categories, allProducts] = await Promise.all([getCategoriesLive(), getAllProductsLive()]);
  const category = categories.find((c) => c.id === categoryId);
  if (!city || !category) notFound();

  const products = allProducts.filter((p) => p.categoryId === category.id);

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
