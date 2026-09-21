import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllCitiesSync, getCityBySlugSync } from "@/lib/data/cities";
import { getAllServicesSync, getServiceBySlug } from "@/lib/data/services";
import { getAllProductsSync } from "@/lib/data/products";
import { getCategoryById } from "@/lib/data/categories";
import { getServiceTypeByIdSync } from "@/lib/data/serviceTypes";
import { getOffersForServiceSync } from "@/lib/data/offers";
import { Container } from "@/components/ui/Container";
import { ServiceGallery } from "@/components/service/ServiceGallery";
import { ServicePriceBlock } from "@/components/service/ServicePriceBlock";
import { ServiceActions } from "@/components/service/ServiceActions";
import { OfferTile } from "@/components/service/OfferTile";

export function generateStaticParams() {
  const cities = getAllCitiesSync();
  const services = getAllServicesSync();
  return cities.flatMap((city) => services.map((service) => ({ city: city.slug, serviceSlug: service.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; serviceSlug: string }>;
}): Promise<Metadata> {
  const { city: citySlug, serviceSlug } = await params;
  const city = getCityBySlugSync(citySlug);
  if (!city) return {};
  const service = await getServiceBySlug(serviceSlug, { cityId: city.id });
  if (!service) return {};
  return {
    title: `${service.name} in ${city.name}`,
    description: service.shortDescription,
  };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ city: string; serviceSlug: string }>;
}) {
  const { city: citySlug, serviceSlug } = await params;
  const city = getCityBySlugSync(citySlug);
  if (!city) notFound();

  const service = await getServiceBySlug(serviceSlug, { cityId: city.id });
  if (!service) notFound();

  const product = getAllProductsSync().find((p) => p.id === service.productId);
  const category = product ? getCategoryById(product.categoryId) : undefined;
  const serviceType = getServiceTypeByIdSync(service.serviceTypeId);
  const offers = getOffersForServiceSync(service.id);

  return (
    <section className="py-8 sm:py-12">
      <Container>
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-neutral-500">
          <Link href={`/${city.slug}`} className="hover:text-brand-700">
            {city.name}
          </Link>
          {product && (
            <>
              {" / "}
              <Link href={`/${city.slug}/${product.categoryId}`} className="hover:text-brand-700">
                {category?.name ?? product.categoryId}
              </Link>
              {" / "}
              <Link href={`/${city.slug}/${product.categoryId}/${product.slug}`} className="hover:text-brand-700">
                {product.name}
              </Link>
            </>
          )}
        </nav>

        <div className="grid gap-10 lg:grid-cols-2">
          <ServiceGallery images={service.images} serviceName={service.name} />

          <div>
            {serviceType && (
              <span className="mb-2 inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
                {serviceType.label}
              </span>
            )}
            <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl">
              {service.name}
            </h1>
            <p className="mt-2 text-sm text-neutral-500">Available in {city.name}</p>

            <p className="mt-4 text-base text-neutral-700">{service.description}</p>

            <div className="mt-6">
              <ServicePriceBlock service={service} />
            </div>

            {offers.length > 0 && (
              <div className="mt-4">
                <OfferTile offers={offers} />
              </div>
            )}

            <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              What&rsquo;s included
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {service.whatsIncluded.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-neutral-700">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <ServiceActions service={service} citySlug={city.slug} />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
