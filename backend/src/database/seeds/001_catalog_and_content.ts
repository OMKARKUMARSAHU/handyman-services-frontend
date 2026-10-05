import type { Knex } from "knex";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Catalog + homepage-content seed — AUDIT FOLLOW-UP ("Admin CMS/content-
 * management pipeline"). Ports the existing mock catalog
 * (frontend `src/data/*.json`, Phase 3's illustrative content) into the
 * real database tables that already existed but were never populated, so
 * switching the customer-facing homepage from static JSON to live backend
 * reads produces an IDENTICAL day-one experience — the only difference
 * being that every one of these rows is now an Admin-editable database
 * row instead of a file in the repo.
 *
 * Idempotent: every insert is "insert only if a row with this natural key
 * (slug / key) doesn't already exist" so re-running `seed:run` after an
 * Admin has already edited some of this content never clobbers their
 * changes or throws a duplicate-key error.
 *
 * `created_by_user_id` on seeded services is a fixed placeholder sentinel
 * (no real admins table exists — services.created_by_user_id just stores
 * whichever Cognito `sub` created the row; there is no seed-time Cognito
 * user, so this well-known all-zero UUID marks "pre-existing/seeded
 * content" rather than inventing a fake-but-plausible Cognito sub).
 */
const SEED_ADMIN_SUB = "00000000-0000-0000-0000-000000000000";

function readJson<T>(relativePath: string): T {
  // backend/src/database/seeds/<this file> -> project root/src/data/<relativePath>
  const file = path.join(__dirname, "../../../../src/data", relativePath);
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function stripNullish(obj: Record<string, unknown>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "boolean") {
      out[k] = v ? 1 : 0;
    } else if (typeof v === "string" || typeof v === "number") {
      out[k] = v;
    }
  }
  return out;
}

interface MockCity {
  id: string;
  name: string;
  state: string;
  slug: string;
  isPopular: boolean;
  active: boolean;
  sortOrder: number;
  iconUrl?: string | null;
  iconAlt?: string | null;
}
interface MockCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  image: string | null;
  sortOrder: number;
}
interface MockProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  image: string | null;
  categoryId: string;
  sortOrder: number;
  active: boolean;
}
interface MockServiceType {
  id: string;
  key: string;
  label: string;
  sortOrder: number;
  active: boolean;
}
interface MockServiceImage {
  id: string;
  serviceId: string;
  url: string;
  alt: string;
  sortOrder: number;
}
interface MockService {
  id: string;
  slug: string;
  productId: string;
  serviceTypeId: string;
  name: string;
  shortDescription: string;
  description: string;
  whatsIncluded: string[];
  images: MockServiceImage[];
  mrp: number;
  offerPrice: number;
  ratingAverage: number | null;
  ratingCount: number;
  isMostBooked: boolean;
  featured: boolean;
  active: boolean;
  sortOrder: number;
}
interface MockAvailability {
  id: string;
  serviceId: string;
  cityId: string;
  active: boolean;
}
interface MockOffer {
  id: string;
  title: string;
  description: string;
  discountType: "percent" | "flat";
  discountValue: number;
  appliesTo: { scope: "all" | "category" | "service"; ids: string[] };
  bannerImage: string | null;
  startDate: string | null;
  endDate: string | null;
  active: boolean;
}
interface MockHomepageSection {
  key: string;
  heading: string;
  subheading: string | null;
  body: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  items: Record<string, unknown>[] | null;
  sortOrder: number;
  image?: string | null;
  imageAlt?: string | null;
}
interface MockVideoCuration {
  id: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  serviceTypeId: string | null;
  thumbnail: string | null;
  videoUrl: string | null;
  externalUrl: string | null;
  durationSeconds: number | null;
  sortOrder: number;
  active: boolean;
}

export async function seed(knex: Knex): Promise<void> {
  // ---- Cities ----
  const cities = readJson<MockCity[]>("cities.json");
  const cityIdBySlug = new Map<string, string>();
  for (const c of cities) {
    const existing = await knex("cities").where({ slug: c.slug }).first();
    if (existing) {
      cityIdBySlug.set(c.slug, existing.id);
      continue;
    }
    const id = randomUUID();
    await knex("cities").insert({
      id,
      name: c.name,
      state: c.state,
      slug: c.slug,
      is_popular: c.isPopular,
      active: c.active,
      sort_order: c.sortOrder,
      icon_url: c.iconUrl ?? null,
      icon_alt: c.iconAlt ?? null,
    });
    cityIdBySlug.set(c.slug, id);
  }

  // ---- Categories ----
  const categories = readJson<MockCategory[]>("categories.json");
  const categoryIdBySlug = new Map<string, string>();
  for (const c of categories) {
    const existing = await knex("categories").where({ slug: c.id }).first();
    if (existing) {
      categoryIdBySlug.set(c.id, existing.id);
      continue;
    }
    const id = randomUUID();
    await knex("categories").insert({
      id,
      slug: c.id,
      name: c.name,
      description: c.description,
      icon: c.icon,
      image: c.image ?? null,
      sort_order: c.sortOrder,
      active: true,
    });
    categoryIdBySlug.set(c.id, id);
  }

  // ---- Products ----
  const products = readJson<MockProduct[]>("products.json");
  const productIdBySlug = new Map<string, string>();
  for (const p of products) {
    const existing = await knex("products").where({ slug: p.id }).first();
    if (existing) {
      productIdBySlug.set(p.id, existing.id);
      continue;
    }
    const categoryId = categoryIdBySlug.get(p.categoryId);
    if (!categoryId) {
      console.warn(`[seed] Skipping product "${p.id}" — unknown category "${p.categoryId}".`);
      continue;
    }
    const id = randomUUID();
    await knex("products").insert({
      id,
      category_id: categoryId,
      slug: p.id,
      name: p.name,
      description: p.description,
      icon: p.icon,
      image: p.image ?? null,
      sort_order: p.sortOrder,
      active: p.active,
    });
    productIdBySlug.set(p.id, id);
  }

  // ---- Service types ----
  const serviceTypes = readJson<MockServiceType[]>("serviceTypes.json");
  const serviceTypeIdByKey = new Map<string, string>();
  for (const t of serviceTypes) {
    const existing = await knex("service_types").where({ key: t.key }).first();
    if (existing) {
      serviceTypeIdByKey.set(t.key, existing.id);
      continue;
    }
    const id = randomUUID();
    await knex("service_types").insert({
      id,
      key: t.key,
      label: t.label,
      sort_order: t.sortOrder,
      active: t.active,
    });
    serviceTypeIdByKey.set(t.key, id);
  }

  // ---- Services (+ images) ----
  const services = readJson<MockService[]>("services.json");
  const serviceIdBySlug = new Map<string, string>();
  for (const s of services) {
    const existing = await knex("services").where({ slug: s.slug }).first();
    if (existing) {
      serviceIdBySlug.set(s.id, existing.id);
      continue;
    }
    const productId = productIdBySlug.get(s.productId);
    const serviceTypeId = serviceTypeIdByKey.get(s.serviceTypeId);
    if (!productId || !serviceTypeId) {
      console.warn(`[seed] Skipping service "${s.id}" — unknown product/service-type reference.`);
      continue;
    }
    const id = randomUUID();
    await knex("services").insert({
      id,
      slug: s.slug,
      product_id: productId,
      service_type_id: serviceTypeId,
      name: s.name,
      short_description: s.shortDescription,
      description: s.description,
      whats_included: JSON.stringify(s.whatsIncluded ?? []),
      mrp: s.mrp,
      offer_price: s.offerPrice,
      rating_average: s.ratingAverage,
      rating_count: s.ratingCount ?? 0,
      is_most_booked: s.isMostBooked,
      featured: s.featured,
      active: s.active,
      sort_order: s.sortOrder,
      approval_status: "approved",
      created_by_role: "admin",
      created_by_user_id: SEED_ADMIN_SUB,
      approved_by_user_id: SEED_ADMIN_SUB,
      approved_at: new Date(),
    });
    serviceIdBySlug.set(s.id, id);

    for (const img of s.images ?? []) {
      await knex("service_images").insert({
        id: randomUUID(),
        service_id: id,
        url: img.url,
        alt: img.alt,
        sort_order: img.sortOrder,
      });
    }
  }

  // ---- Service city availability ----
  const availability = readJson<MockAvailability[]>("serviceCityAvailability.json");
  for (const a of availability) {
    const serviceId = serviceIdBySlug.get(a.serviceId);
    const cityId = cityIdBySlug.get(a.cityId);
    if (!serviceId || !cityId) continue;
    const existing = await knex("service_city_availability").where({ service_id: serviceId, city_id: cityId }).first();
    if (existing) continue;
    await knex("service_city_availability").insert({
      id: randomUUID(),
      service_id: serviceId,
      city_id: cityId,
      active: a.active,
    });
  }

  // ---- Offers ----
  const offers = readJson<MockOffer[]>("offers.json");
  for (const o of offers) {
    const existing = await knex("offers").where({ title: o.title }).first();
    if (existing) continue;
    let ids: string[] = [];
    if (o.appliesTo.scope === "category") {
      ids = o.appliesTo.ids.map((slug) => categoryIdBySlug.get(slug)).filter((v): v is string => Boolean(v));
    } else if (o.appliesTo.scope === "service") {
      ids = o.appliesTo.ids.map((slug) => serviceIdBySlug.get(slug)).filter((v): v is string => Boolean(v));
    }
    await knex("offers").insert({
      id: randomUUID(),
      title: o.title,
      description: o.description,
      discount_type: o.discountType,
      discount_value: o.discountValue,
      applies_to_scope: o.appliesTo.scope,
      applies_to_ids: JSON.stringify(ids),
      applicability_type: "all_india",
      city_id: null,
      banner_image: o.bannerImage ?? null,
      start_date: o.startDate,
      end_date: o.endDate,
      active: o.active,
    });
  }

  // ---- Homepage sections (hero / trustStats / howItWorks / whyChooseUs / finalCta) ----
  const sections = readJson<MockHomepageSection[]>("homepage-sections.json");
  for (const s of sections) {
    const existing = await knex("homepage_sections").where({ key: s.key }).first();
    if (existing) continue;
    const items = (s.items ?? []).map((item) => stripNullish(item));
    await knex("homepage_sections").insert({
      key: s.key,
      heading: s.heading,
      subheading: s.subheading,
      body: s.body,
      cta_text: s.ctaText,
      cta_link: s.ctaLink,
      items: items.length > 0 ? JSON.stringify(items) : null,
      sort_order: s.sortOrder,
      image: s.image ?? null,
      image_alt: s.imageAlt ?? null,
    });
  }

  // ---- Homepage section: video curations (NEW key — no mock homepage-sections.json entry existed for this; ported from the separate video-curations.json data file into the same generic, already-Admin-wired homepage_sections.items mechanism) ----
  const videoCurationsExisting = await knex("homepage_sections").where({ key: "video-curations" }).first();
  if (!videoCurationsExisting) {
    const curations = readJson<MockVideoCuration[]>("video-curations.json");
    const items = curations.map((c) =>
      stripNullish({
        id: c.id,
        title: c.title,
        description: c.description,
        categoryId: c.categoryId,
        serviceTypeId: c.serviceTypeId,
        thumbnail: c.thumbnail,
        videoUrl: c.videoUrl,
        externalUrl: c.externalUrl,
        durationSeconds: c.durationSeconds,
        sortOrder: c.sortOrder,
        active: c.active,
      })
    );
    await knex("homepage_sections").insert({
      key: "video-curations",
      heading: "Real service visits, on video",
      subheading: "A look at what a technician visit actually involves.",
      body: null,
      cta_text: null,
      cta_link: null,
      items: JSON.stringify(items),
      sort_order: 6,
      image: null,
      image_alt: null,
    });
  }
}
