import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllCitiesSync, getCityBySlugSync } from "@/lib/data/cities";
import { getCategoryById } from "@/lib/data/categories";
import { getAllProductsSync, getProductBySlugSync } from "@/lib/data/products";
import { getServicesByProduct } from "@/lib/data/services";
import { getServiceTypes } from "@/lib/data/serviceTypes";
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

export default async function ProductPage({
  params,
}: {
  params: Promise<{ city: string; category: string; product: string }>;
}) {
  const { city: citySlug, category: categoryId, product: productSlug } = await params;
  const city = getCityBySlugSync(citySlug);
  const category = getCategoryById(categoryId);
  const product = getProductBySlugSync(categoryId, productSlug);
  if (!city || !category || !product) notFound();

  const services = await getServicesByProduct(product.id, { cityId: city.id });
  const serviceTypes = await getServiceTypes();

  return (
    <>
      <PageHeader heading={`${product.name} Services in ${city.name}`} subheading={product.description} />
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
