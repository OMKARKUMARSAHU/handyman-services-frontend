import type { MetadataRoute } from "next";
import { getCategories } from "@/lib/data";
import { getAllCitiesSync } from "@/lib/data/cities";
import { getAllProductsSync } from "@/lib/data/products";
import { getAllServicesSync } from "@/lib/data/services";

const BASE_URL = "https://handymanservices.in";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: "yearly", priority: 1 },
    { url: `${BASE_URL}/services`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/about`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${BASE_URL}/faq`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/contact`, changeFrequency: "yearly", priority: 0.7 },
  ];

  // Legacy category routes (still live, unlinked from primary nav — see
  // PHASE_2_PAGE_STRUCTURE.md §1) are intentionally left out of the sitemap
  // now that /[city]/[category] is the canonical, linked equivalent, to
  // avoid submitting duplicate/superseded URLs for indexing.

  const cities = getAllCitiesSync();
  const categories = getCategories();
  const products = getAllProductsSync();
  const services = getAllServicesSync();

  const cityRoutes: MetadataRoute.Sitemap = cities.map((city) => ({
    url: `${BASE_URL}/${city.slug}`,
    changeFrequency: "weekly",
    priority: 0.9,
  }));

  const categoryRoutes: MetadataRoute.Sitemap = cities.flatMap((city) =>
    categories.map((category) => ({
      url: `${BASE_URL}/${city.slug}/${category.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }))
  );

  const productRoutes: MetadataRoute.Sitemap = cities.flatMap((city) =>
    products.map((product) => ({
      url: `${BASE_URL}/${city.slug}/${product.categoryId}/${product.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }))
  );

  const serviceRoutes: MetadataRoute.Sitemap = cities.flatMap((city) =>
    services
      .filter((s) => s.availableCityIds.includes(city.id))
      .map((service) => ({
        url: `${BASE_URL}/${city.slug}/service/${service.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }))
  );

  return [...staticRoutes, ...cityRoutes, ...categoryRoutes, ...productRoutes, ...serviceRoutes];
}
