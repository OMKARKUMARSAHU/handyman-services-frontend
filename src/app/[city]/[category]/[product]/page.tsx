import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCityBySlugSync } from "@/lib/data/cities";
import { getCategoryById } from "@/lib/data/categories";
import { getProductBySlugSync } from "@/lib/data/products";
import { getServiceTypes } from "@/lib/data/serviceTypes";
import { getAllProductsLive, getServicesByProductLive } from "@/lib/data/live";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { ProductServicesSection } from "@/components/catalog/ProductServicesSection";

/**
 * BUILD-TIME FIX (Vercel build timeout -- "took more than 60 seconds ...
 * after 3 attempts ... Next.js build worker exited with code: 1"): this
 * previously returned every city x product combination, forcing
 * `next build` to eagerly render every `/[city]/[category]/[product]`
 * page right now by calling this page's body -- which fetches live
 * products + services from the backend via `@/lib/data/live` -- once per
 * combination, synchronously, during the build. If the backend is slow,
 * cold, or unreachable from Vercel's build network at that moment, a
 * render can hang past Next's internal per-page budget, and after 3
 * retries Next kills the build -- this is exactly what was happening to
 * /ranchi/consumer-durables/air-conditioner, /ranchi/consumer-durables/
 * refrigerator, etc.
 *
 * Returning an empty array means `next build` pre-renders ZERO
 * `/[city]/[category]/[product]` pages -- no backend calls happen at
 * build time, so the build can never fail because of backend latency/
 * unavailability again. `dynamicParams` below (default `true`, made
 * explicit so this can't silently regress) is what keeps every one of
 * these URLs working exactly as before: the first visitor to any
 * combination renders it on demand (full server-rendered HTML, same
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
  params: Promise<{ city: string; category: string; product: string }>;
}): Promise<Metadata> {
  const { city: citySlug, category: categoryId, product: productSlug } = await params;
  const city = getCityBySlugSync(citySlug);
  const product = getProductBySlugSync(categoryId, productSlug);
  if (!city || !product) return {};
  return {
    title: `${product.name} Services in ${city.name}`,
    description: product.description,
  };
}

/**
 * AUDIT FOLLOW-UP ("Admin CMS/content-management pipeline" -- "real
 * product photos, not icons"): product + service reads now go through
 * `@/lib/data/live` (falling back to mock if the backend is unreachable),
 * completing the live CATEGORY > PRODUCT > SERVICE TYPE > SERVICE
 * click-through started on the homepage and category page. `category`
 * is still resolved via the mock `getCategoryById` purely to validate the
 * `category` URL segment against the product's own categoryId (a 404
 * check, not content); the actual rendered category name everywhere else
 * on the site already comes from the live reader.
 */
export default async function ProductPage({
  params,
}: {
  params: Promise<{ city: string; category: string; product: string }>;
}) {
  const { city: citySlug, category: categoryId, product: productSlug } = await params;
  const city = getCityBySlugSync(citySlug);
  const category = getCategoryById(categoryId);
  const allProducts = await getAllProductsLive();
  const product = allProducts.find((p) => p.categoryId === categoryId && p.slug === productSlug);
  if (!city || !category || !product) notFound();

  const services = await getServicesByProductLive(product.id, { citySlug: city.slug });
  const serviceTypes = await getServiceTypes();

  return (
    <>
      <PageHeader
        heading={`${product.name} Services in ${city.name}`}
        subheading={product.description}
      />
      <section className="py-10 sm:py-14">
        <Container>
          {/*
            Accessibility fix (Phase 4 QA): PageHeader renders an <h1>, and
            ServiceCard's title is an <h3> — with nothing in between, that
            was a skipped heading level (axe "heading-order"). This sr-only
            <h2> restores a correct 1→2→3 outline without changing anything
            visible.
          */}
          <h2 className="sr-only">Services for {product.name}</h2>
          <ProductServicesSection services={services} serviceTypes={serviceTypes} citySlug={city.slug} />
        </Container>
      </section>
    </>
  );
}
