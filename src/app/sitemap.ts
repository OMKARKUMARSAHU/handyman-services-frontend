import type { MetadataRoute } from "next";
import { getCategories } from "@/lib/data";

const BASE_URL = "https://handymanservices.in";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: "yearly", priority: 1 },
    { url: `${BASE_URL}/services`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/plans`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/about`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${BASE_URL}/faq`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/contact`, changeFrequency: "yearly", priority: 0.7 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = getCategories().map((category) => ({
    url: `${BASE_URL}/services/${category.id}`,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...categoryRoutes];
}
