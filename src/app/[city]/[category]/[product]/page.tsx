import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllCitiesSync, getCityBySlugSync } from "@/lib/data/cities";
import { getCategoryById } from "@/lib/data/categories";
import { getAllProductsSync, getProductBySlugSync } from "@/lib/data/products";
import { getServiceTypes } from "@/lib/data/serviceTypes";
import { getAllProductsLive, getServicesByProductLive } from "@/lib/data/live";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { ProductServicesSection } from "@/components/catalog/ProductServicesSection";

export function generateStaticParams() {
  const cities = getAllCitiesSync();
  const products = getAllProductsSync();
  return cities.flatMap((city) =>
    products.map((product) => ({ city: city.slug, category: product.categoryId, product: product.slug }))
  );
}

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
