import type { MetadataRoute } from "next";
import { getCategories } from "@/lib/data";
import { getAllCitiesSync } from "@/lib/data/cities";
import { getAllProductsSync } from "@/lib/data/products";
import { getAllServicesSync } from "@/lib/data/services";
import { listPublishedBlogSlugsLive } from "@/lib/data/live";

const BASE_URL = "https://handymanservices.in";

/**
 * Blog Management System (Task 4, §6/§7 — "automatic Google indexing via
 * sitemap only"). `sitemap()` becomes async here (Next.js supports an
 * async default export for this file; this is the only change to the
 * function's signature) solely to await `listPublishedBlogSlugsLive()`,
 * which hits the backend's `GET /blog/sitemap-urls` — itself filtered to
 * PUBLISHED posts only, so a draft/scheduled/archived post's URL can
 * never be submitted for indexing through this file. Every other route
 * group below (static/city/category/product/service) is byte-for-byte
 * unchanged from before this pass.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: "yearly", priority: 1 },
    { url: `${BASE_URL}/services`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/about`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${BASE_URL}/faq`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/contact`, changeFrequency: "yearly", priority: 0.7 },
    { url: `${BASE_URL}/blog`, changeFrequency: "daily", priority: 0.7 },
  ];

  // Legacy category routes (still live, unlinked from primary nav — see
  // PHASE_2_PAGE_STRUCTURE.md §1) are intentionally left out of the sitemap
  // now that /[city]/[category] is the canonical, linked equivalent, to
  // avoid submitting duplicate/superseded URLs for indexing.

  const cities = getAllCitiesSync();
  const categories = getCategories();
  const products = getAllProductsSync();
  const services = getAllServicesSync();
  const publishedBlogPosts = await listPublishedBlogSlugsLive();

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

  const blogPostRoutes: MetadataRoute.Sitemap = publishedBlogPosts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: post.updatedAt ? new Date(post.updatedAt) : undefined,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [
    ...staticRoutes,
    ...cityRoutes,
    ...categoryRoutes,
    ...productRoutes,
    ...serviceRoutes,
    ...blogPostRoutes,
  ];
}
