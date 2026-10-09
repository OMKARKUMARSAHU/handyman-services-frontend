import type { Category, Product, Service, Offer, HomepageSection, HomepageSectionItem, VideoCuration, VideoCurationClip } from "@/types";
import { getCategories as getCategoriesMock } from "./categories";
import { getAllProductsSync as getAllProductsMock } from "./products";
import {
  getFeaturedServicesSync as getFeaturedServicesMock,
  getMostBookedServicesSync as getMostBookedServicesMock,
  getServicesByCategorySync as getServicesByCategoryMock,
  getServiceBySlug as getServiceBySlugMock,
  getServicesByProduct as getServicesByProductMock,
} from "./services";
import { getOffers as getOffersMock, getOffersForServiceSync as getOffersForServiceMock } from "./offers";
import { getHomepageSection as getHomepageSectionMock } from "./homepageSections";
import { getVideoCurations as getVideoCurationsMock } from "./videoCurations";
import { cleanUrl } from "@/lib/video/playlist";
import { makeUniqueId } from "@/lib/video/identity";

/**
 * Live, backend-backed catalog + homepage-content reads (AUDIT FOLLOW-UP —
 * "Admin CMS/content-management pipeline"). This file is additive, not a
 * replacement: every existing export in this directory (`getCategories`,
 * `getAllProductsSync`, `getFeaturedServicesSync`, `getCityBySlugSync`,
 * `getOffers`, `getHomepageSection`, `getVideoCurations`, …) is untouched
 * and keeps reading the mock JSON exactly as before — every genuinely
 * client-side, instant-synchronous consumer (CartProvider, CartLineItem,
 * OrderSummaryStep, SearchBox, CitySelectorModal, LocationSelector,
 * ProviderSignupForm, the legacy `/services/[category]` route, the city/
 * category/product/service DETAIL pages, cart, checkout, order
 * confirmation) still reads that unchanged data and is completely
 * unaffected by anything in this file.
 *
 * What's here is a SEPARATE set of functions — only called from the
 * homepage (`app/page.tsx`, `app/[city]/page.tsx`) — that fetch the exact
 * same shape of data from the real backend (the same database Admin's
 * Catalog + Homepage Content panels write to) instead of the repo's
 * static JSON, with every entity's frontend-facing "id" mapped to its
 * backend `slug` (never the backend's internal UUID) so every existing
 * route/link built from that id (`/${city}/${category.id}`,
 * `/${city}/${product.categoryId}/${product.slug}`, …) keeps resolving
 * correctly against the still-mock-backed detail pages, since the seed
 * script (`backend/src/database/seeds/001_catalog_and_content.ts`) gives
 * every seeded row the exact same slug the mock JSON already used as its
 * "id". If the backend is unreachable or returns an error, every function
 * below falls back to the existing mock reader — the homepage never goes
 * blank because of this.
 *
 * City selection itself is explicitly NOT migrated here (cities.ts, the
 * city selector, and LocationProvider all stay on the mock city list) —
 * out of scope for this pass; see the citySlug→backend-city-id resolution
 * in `getLiveCatalogContext` below, used only to filter the live
 * services/offers reads by city, never to drive the selector UI itself.
 */

import { BROWSER_PROXY_BASE_PATH, DIRECT_BACKEND_BASE_URL, isBrowserRuntime } from "@/lib/server/backend-url";

/** Balances "Admin changes should automatically appear" against not re-fetching the whole catalog on every single request. */
const REVALIDATE_SECONDS = 30;

// PHASE R: most callers of this file are server-rendered catalog pages
// (app/page.tsx, app/[city]/page.tsx, ...), but the checkout page also
// calls the two *BackendIdBySlugLive lookups client-side -- so, exactly
// like @/lib/auth/api, this has to branch at runtime rather than assume
// it only ever runs on the server. See @/lib/server/backend-url.
async function backendGet<T>(path: string): Promise<T | null> {
  try {
    const base = isBrowserRuntime() ? BROWSER_PROXY_BASE_PATH : DIRECT_BACKEND_BASE_URL;
    const res = await fetch(
      `${base}${path}`,
      isBrowserRuntime() ? { cache: "no-store" } : { next: { revalidate: REVALIDATE_SECONDS } }
    );
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as { success?: boolean; data?: T } | null;
    if (!body || body.success === false || body.data === undefined) return null;
    return body.data;
  } catch {
    return null;
  }
}

interface BackendCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  image: string | null;
  sortOrder: number;
  active: boolean;
}
interface BackendProduct {
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
interface BackendCity {
  id: string;
  slug: string;
  active: boolean;
}
interface BackendServiceType {
  id: string;
  key: string;
}
interface BackendServiceImage {
  id: string;
  url: string;
  alt: string;
  sortOrder: number;
  mediaType: "image" | "video";
}
interface BackendService {
  id: string;
  slug: string;
  productId: string;
  serviceTypeId: string;
  name: string;
  shortDescription: string;
  description: string;
  whatsIncluded: string[];
  images: BackendServiceImage[];
  mrp: number;
  offerPrice: number;
  discountPercent: number;
  discountAmount: number;
  ratingAverage: number | null;
  ratingCount: number;
  isMostBooked: boolean;
  availableCityIds: string[];
  featured: boolean;
  active: boolean;
  sortOrder: number;
}
interface BackendOffer {
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
type BackendHomepageSectionItemValue = string | number | Record<string, string | number | null>[];
interface BackendHomepageSection {
  key: string;
  heading: string;
  subheading: string | null;
  body: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  items: Record<string, BackendHomepageSectionItemValue>[] | null;
  sortOrder: number;
  image: string | null;
  imageAlt: string | null;
}

export interface LiveCatalogContext {
  categories: Category[];
  products: Product[];
  cityBackendIdBySlug: Map<string, string>;
  categoryBackendIdBySlug: Map<string, string>;
  categorySlugByBackendId: Map<string, string>;
  productSlugByBackendId: Map<string, string>;
  productBackendIdBySlug: Map<string, string>;
  serviceTypeKeyByBackendId: Map<string, string>;
  citySlugByBackendId: Map<string, string>;
}

let cachedContext: { value: LiveCatalogContext; expiresAt: number } | null = null;

/**
 * Fetches cities + categories + products (one call per category, via the
 * existing `/categories/:slug/products` route — there is no "all
 * products" endpoint) + service types, once, and builds every id⇄slug map
 * the rest of this file needs. Cached in-process for REVALIDATE_SECONDS so
 * one server render that needs this more than once (hero + multiple
 * rails + banners) doesn't refetch the same reference data repeatedly.
 * Returns null — triggering a full fallback to mock data in every caller
 * below — if any required fetch fails.
 */
export async function getLiveCatalogContext(): Promise<LiveCatalogContext | null> {
  if (cachedContext && cachedContext.expiresAt > Date.now()) return cachedContext.value;

  const [citiesRaw, categoriesRaw, serviceTypesRaw] = await Promise.all([
    backendGet<BackendCity[]>("/cities"),
    backendGet<BackendCategory[]>("/categories"),
    backendGet<BackendServiceType[]>("/service-types"),
  ]);
  // AUDIT FOLLOW-UP ("Browse by Category" showing only "All Services" on a
  // *reachable* local backend whose database has never been migrated/
  // seeded): a reachable-but-empty response is a successful fetch, so the
  // original `!categoriesRaw` style checks only ever caught a *failed*
  // fetch (network error / non-2xx -> backendGet returns null), never an
  // empty-but-200 catalog. Treat "reachable with zero rows" the same as
  // "unreachable" so every *Live reader below falls back to the full mock
  // catalog instead of rendering an empty category/product/service list.
  if (
    !citiesRaw ||
    !categoriesRaw ||
    !serviceTypesRaw ||
    citiesRaw.length === 0 ||
    categoriesRaw.length === 0 ||
    serviceTypesRaw.length === 0
  ) {
    return null;
  }

  const productsPerCategory = await Promise.all(
    categoriesRaw.map((c) => backendGet<BackendProduct[]>(`/categories/${c.slug}/products`))
  );
  if (productsPerCategory.some((p) => p === null)) return null;
  const productsRaw = productsPerCategory.flat() as BackendProduct[];

  const categorySlugByBackendId = new Map(categoriesRaw.map((c) => [c.id, c.slug]));
  const categoryBackendIdBySlug = new Map(categoriesRaw.map((c) => [c.slug, c.id]));
  const productSlugByBackendId = new Map(productsRaw.map((p) => [p.id, p.slug]));
  const productBackendIdBySlug = new Map(productsRaw.map((p) => [p.slug, p.id]));
  const serviceTypeKeyByBackendId = new Map(serviceTypesRaw.map((t) => [t.id, t.key]));
  const citySlugByBackendId = new Map(citiesRaw.map((c) => [c.id, c.slug]));
  const cityBackendIdBySlug = new Map(citiesRaw.map((c) => [c.slug, c.id]));

  const categories: Category[] = categoriesRaw
    .filter((c) => c.active)
    .map((c) => ({
      id: c.slug,
      name: c.name,
      description: c.description,
      icon: c.icon,
      image: c.image,
      applianceIds: productsRaw.filter((p) => p.categoryId === c.id).map((p) => p.slug),
      sortOrder: c.sortOrder,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const products: Product[] = productsRaw
    .filter((p) => p.active)
    .map((p) => ({
      id: p.slug,
      slug: p.slug,
      name: p.name,
      description: p.description,
      icon: p.icon,
      image: p.image,
      categoryId: categorySlugByBackendId.get(p.categoryId) ?? p.categoryId,
      sortOrder: p.sortOrder,
      active: p.active,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const value: LiveCatalogContext = {
    categories,
    products,
    cityBackendIdBySlug,
    categoryBackendIdBySlug,
    categorySlugByBackendId,
    productSlugByBackendId,
    productBackendIdBySlug,
    serviceTypeKeyByBackendId,
    citySlugByBackendId,
  };
  cachedContext = { value, expiresAt: Date.now() + REVALIDATE_SECONDS * 1000 };
  return value;
}

function mapService(dto: BackendService, ctx: LiveCatalogContext): Service {
  return {
    id: dto.slug,
    slug: dto.slug,
    productId: ctx.productSlugByBackendId.get(dto.productId) ?? dto.productId,
    serviceTypeId: ctx.serviceTypeKeyByBackendId.get(dto.serviceTypeId) ?? dto.serviceTypeId,
    name: dto.name,
    shortDescription: dto.shortDescription,
    description: dto.description,
    whatsIncluded: dto.whatsIncluded,
    images: dto.images.map((img) => ({
      id: img.id,
      serviceId: dto.slug,
      url: img.url,
      alt: img.alt,
      sortOrder: img.sortOrder,
      mediaType: img.mediaType,
    })),
    mrp: dto.mrp,
    offerPrice: dto.offerPrice,
    discountPercent: dto.discountPercent,
    discountAmount: dto.discountAmount,
    ratingAverage: dto.ratingAverage,
    ratingCount: dto.ratingCount,
    isMostBooked: dto.isMostBooked,
    availableCityIds: dto.availableCityIds
      .map((cid) => ctx.citySlugByBackendId.get(cid))
      .filter((v): v is string => Boolean(v)),
    featured: dto.featured,
    active: dto.active,
    sortOrder: dto.sortOrder,
  };
}

/**
 * RAZORPAY/CHECKOUT FOLLOW-UP ("The request failed validation" —
 * `items[0].cityId`/`items[0].serviceId` not UUIDs): every *Live mapper in
 * this file deliberately maps an entity's frontend-facing `id` to its
 * backend SLUG, never the backend's internal UUID (see this file's top
 * doc comment) — that is correct for ROUTING/DISPLAY (links, cart-item
 * lookups via getServiceByIdSync, etc.), which must stay slug-based. But
 * the real backend's cart/order endpoints validate `serviceId`/`cityId`
 * as actual UUIDs (cart.schema.ts) — they were never meant to receive a
 * slug. These two resolvers are the ONLY place that hands back the real
 * backend UUID, for the ONE place that actually needs it: checkout
 * resolving the local (slug-keyed) cart into the server cart just before
 * calling `mergeMyCart()`. Nothing about routing/display changes.
 */
export async function getCityBackendIdBySlugLive(citySlug: string): Promise<string | null> {
  const ctx = await getLiveCatalogContext();
  return ctx?.cityBackendIdBySlug.get(citySlug) ?? null;
}

/** Lightweight id-only lookup (distinct from getServiceDetailLive's full detail+offers fetch) — checkout may need to resolve several distinct services at once. */
export async function getServiceBackendIdBySlugLive(slug: string): Promise<string | null> {
  const dto = await backendGet<{ id: string }>(`/services/${encodeURIComponent(slug)}`);
  return dto?.id ?? null;
}

export async function getCategoriesLive(): Promise<Category[]> {
  const ctx = await getLiveCatalogContext();
  return ctx ? ctx.categories : getCategoriesMock();
}

export async function getAllProductsLive(): Promise<Product[]> {
  const ctx = await getLiveCatalogContext();
  return ctx ? ctx.products : getAllProductsMock();
}

export async function getFeaturedServicesLive(citySlug?: string): Promise<Service[]> {
  const ctx = await getLiveCatalogContext();
  if (!ctx) return getFeaturedServicesMock(citySlug);
  const params = new URLSearchParams({ featured: "true", pageSize: "20" });
  const cityBackendId = citySlug ? ctx.cityBackendIdBySlug.get(citySlug) : undefined;
  if (cityBackendId) params.set("cityId", cityBackendId);
  const rows = await backendGet<BackendService[]>(`/services?${params.toString()}`);
  if (!rows) return getFeaturedServicesMock(citySlug);
  return rows.map((r) => mapService(r, ctx));
}

export async function getMostBookedServicesLive(citySlug?: string): Promise<Service[]> {
  const ctx = await getLiveCatalogContext();
  if (!ctx) return getMostBookedServicesMock(citySlug);
  const params = new URLSearchParams({ mostBooked: "true", pageSize: "20" });
  const cityBackendId = citySlug ? ctx.cityBackendIdBySlug.get(citySlug) : undefined;
  if (cityBackendId) params.set("cityId", cityBackendId);
  const rows = await backendGet<BackendService[]>(`/services?${params.toString()}`);
  if (!rows) return getMostBookedServicesMock(citySlug);
  return rows.map((r) => mapService(r, ctx));
}

export async function getServicesByCategoryLive(
  categorySlug: string,
  opts?: { citySlug?: string; limit?: number }
): Promise<Service[]> {
  const ctx = await getLiveCatalogContext();
  if (!ctx) return getServicesByCategoryMock(categorySlug, { cityId: opts?.citySlug, limit: opts?.limit });
  const categoryBackendId = ctx.categoryBackendIdBySlug.get(categorySlug);
  if (!categoryBackendId) return [];
  const params = new URLSearchParams({ categoryId: categoryBackendId, pageSize: String(opts?.limit ?? 20) });
  const cityBackendId = opts?.citySlug ? ctx.cityBackendIdBySlug.get(opts.citySlug) : undefined;
  if (cityBackendId) params.set("cityId", cityBackendId);
  const rows = await backendGet<BackendService[]>(`/services?${params.toString()}`);
  if (!rows) return getServicesByCategoryMock(categorySlug, { cityId: opts?.citySlug, limit: opts?.limit });
  const mapped = rows.map((r) => mapService(r, ctx));
  return opts?.limit ? mapped.slice(0, opts.limit) : mapped;
}

/**
 * Single-service detail read for `/[city]/service/[serviceSlug]`
 * (AUDIT FOLLOW-UP -- "real product photos, not icons": this is the one
 * page that was never migrated off mock data, so an Admin-uploaded
 * service image -- already fully supported end-to-end by
 * `ServiceImagesEditor` in `AdminCatalogPanel.tsx` + the backend's
 * `GET /services/:slug` -- never reached the customer-facing gallery
 * until now). Falls back to the exact same mock service + offer-matching
 * logic (`getServiceBySlugMock` / `getOffersForServiceMock`) the page
 * used before, so a missing/unreachable backend degrades exactly as
 * every other `*Live` read in this file does -- never a blank page.
 */
export async function getServiceDetailLive(
  slug: string,
  opts?: { citySlug?: string }
): Promise<{ service: Service; offers: Offer[] } | null> {
  const ctx = await getLiveCatalogContext();
  if (ctx) {
    const cityBackendId = opts?.citySlug ? ctx.cityBackendIdBySlug.get(opts.citySlug) : undefined;
    const params = new URLSearchParams();
    if (cityBackendId) params.set("cityId", cityBackendId);
    const query = params.toString();
    const dto = await backendGet<BackendService>(`/services/${encodeURIComponent(slug)}${query ? `?${query}` : ""}`);
    if (dto) {
      const service = mapService(dto, ctx);
      const allOffers = await getOffersLive(opts?.citySlug ? { citySlug: opts.citySlug } : undefined);
      const product = ctx.products.find((p) => p.id === service.productId);
      const offers = allOffers.filter((o) => {
        if (o.appliesTo.scope === "all") return true;
        if (o.appliesTo.scope === "service") return o.appliesTo.ids.includes(service.id);
        if (o.appliesTo.scope === "category" && product) return o.appliesTo.ids.includes(product.categoryId);
        return false;
      });
      return { service, offers };
    }
  }
  const mockService = await getServiceBySlugMock(slug, opts?.citySlug ? { cityId: opts.citySlug } : undefined);
  if (!mockService) return null;
  return { service: mockService, offers: getOffersForServiceMock(mockService.id) };
}

/**
 * Product -> services read for `/[city]/[category]/[product]`
 * (AUDIT FOLLOW-UP -- CATEGORY > PRODUCT > SERVICE TYPE > SERVICE
 * hierarchy, "a new Service must appear under the correct Service
 * Type/Product/Category/City"). Mirrors `getServicesByCategoryLive`
 * exactly, filtered by product instead of category.
 */
export async function getServicesByProductLive(
  productSlug: string,
  opts?: { citySlug?: string }
): Promise<Service[]> {
  const ctx = await getLiveCatalogContext();
  if (!ctx) return getServicesByProductMock(productSlug, { cityId: opts?.citySlug });
  const productBackendId = ctx.productBackendIdBySlug.get(productSlug);
  if (!productBackendId) return [];
  const params = new URLSearchParams({ productId: productBackendId, pageSize: "50" });
  const cityBackendId = opts?.citySlug ? ctx.cityBackendIdBySlug.get(opts.citySlug) : undefined;
  if (cityBackendId) params.set("cityId", cityBackendId);
  const rows = await backendGet<BackendService[]>(`/services?${params.toString()}`);
  if (!rows) return getServicesByProductMock(productSlug, { cityId: opts?.citySlug });
  return rows.map((r) => mapService(r, ctx)).sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Offer `appliesTo.ids` translation: a `category` scope is translated back
 * to the frontend category slug (so `LargeSpotlightBanner`'s existing
 * `resolveOfferHref` keeps working unchanged). A `service` scope is left
 * as the backend's service UUID — this file doesn't bulk-fetch every
 * service, so there's no id⇄slug map for it here; `resolveOfferHref`'s
 * lookup against `ctx.services` (frontend slugs) simply won't match, and
 * it already falls back to the generic `/services` link in that case —
 * a safe, documented degradation (the banner/offer itself still renders
 * correctly; only that one CTA link is less specific), not a crash.
 */
export async function getOffersLive(opts?: { citySlug?: string }): Promise<Offer[]> {
  const ctx = await getLiveCatalogContext();
  const params = new URLSearchParams();
  const cityBackendId = ctx && opts?.citySlug ? ctx.cityBackendIdBySlug.get(opts.citySlug) : undefined;
  if (cityBackendId) params.set("cityId", cityBackendId);
  const query = params.toString();
  const rows = await backendGet<BackendOffer[]>(`/offers${query ? `?${query}` : ""}`);
  if (!rows || !ctx) return getOffersMock(opts?.citySlug ? { cityId: opts.citySlug } : undefined);
  return rows
    .filter((o) => o.active)
    .map((o) => ({
      id: o.id,
      title: o.title,
      description: o.description,
      discountType: o.discountType,
      discountValue: o.discountValue,
      appliesTo: {
        scope: o.appliesTo.scope,
        ids: o.appliesTo.ids
          .map((backendId) => (o.appliesTo.scope === "category" ? ctx.categorySlugByBackendId.get(backendId) : backendId))
          .filter((v): v is string => Boolean(v)),
      },
      bannerImage: o.bannerImage,
      startDate: o.startDate,
      endDate: o.endDate,
      active: o.active,
    }));
}

// VIDEO SHOWCASE FIX: this used to keep a second, module-level 30 s copy
// of the response (`sectionsCache`) on top of the fetch Data Cache. An
// admin save calls `revalidatePath()` (see the /api/backend proxy route),
// which clears the Data Cache but can NOT clear a module variable -- so a
// card toggled Active/Inactive or deleted kept showing (or staying hidden)
// on the public homepage for up to 30 s after a successful save. The
// fetch in `backendGet` is already cached and de-duplicated per request by
// Next, so the extra layer added staleness and nothing else.
async function getAllHomepageSectionsLive(): Promise<BackendHomepageSection[] | null> {
  return backendGet<BackendHomepageSection[]>("/homepage-sections");
}

export async function getHomepageSectionLive(key: string): Promise<HomepageSection | undefined> {
  const rows = await getAllHomepageSectionsLive();
  if (!rows) return getHomepageSectionMock(key);
  const row = rows.find((r) => r.key === key);
  if (!row) return undefined;
  return {
    key: row.key,
    heading: row.heading,
    subheading: row.subheading,
    body: row.body,
    ctaText: row.ctaText,
    ctaLink: row.ctaLink,
    // Cast: `getHomepageSectionLive` is only ever called for "hero",
    // "whyChooseUs" and "howItWorks" -- none of which ever carry a
    // `clips` array (that shape is specific to "video-curations", read
    // separately via `getVideoCurationsLive`/`parseVideoClip` above) --
    // so every item here is actually a plain string/number record, just
    // typed more broadly at the source to accommodate that other key.
    items: row.items as unknown as HomepageSectionItem[] | null,
    sortOrder: row.sortOrder,
    image: row.image,
    imageAlt: row.imageAlt,
  };
}

/** Parses one raw clip record (see backend content.schema.ts's `homepageSectionClipSchema`) into a typed `VideoCurationClip` — HOMEPAGE ADMIN REBUILD multi-video support. */
function parseVideoClip(raw: Record<string, string | number | null | undefined>, fallbackId: string): VideoCurationClip {
  return {
    id: String(raw.id ?? "").trim() || fallbackId,
    title: raw.title != null ? String(raw.title) : null,
    // cleanUrl: an emptied/removed URL is "no video", never the string "null"/"" (see lib/video/playlist.ts).
    videoUrl: cleanUrl(raw.videoUrl),
    externalUrl: cleanUrl(raw.externalUrl),
    thumbnail: cleanUrl(raw.thumbnail),
    durationSeconds: raw.durationSeconds != null ? Number(raw.durationSeconds) : null,
  };
}

export async function getVideoCurationsLive(): Promise<VideoCuration[]> {
  const rows = await getAllHomepageSectionsLive();
  if (!rows) return getVideoCurationsMock();
  const row = rows.find((r) => r.key === "video-curations");
  if (!row || !row.items) return getVideoCurationsMock();
  const seenCardIds = new Set<string>();
  // Same rule as the Admin editor: clip ids are unique across the whole list.
  const seenClipIds = new Set<string>();
  return row.items
    .map((item, cardIndex) => {
      // Stable, unique identity per card and per clip (never an array index
      // used as a *shared* key): see lib/video/identity.ts.
      const id = makeUniqueId(item.id, `video-curation-${cardIndex + 1}`, seenCardIds);
      const rawClips = item.clips;
      const clips =
        Array.isArray(rawClips) && rawClips.length > 0
          ? rawClips.map((c, clipIndex) => parseVideoClip(c, makeUniqueId(c.id, `${id}-clip-${clipIndex + 1}`, seenClipIds)))
          : undefined;
      return {
        id,
        title: String(item.title ?? ""),
        description: item.description != null ? String(item.description) : null,
        categoryId: item.categoryId != null ? String(item.categoryId) : null,
        serviceTypeId: item.serviceTypeId != null ? String(item.serviceTypeId) : null,
        thumbnail: cleanUrl(item.thumbnail),
        videoUrl: cleanUrl(item.videoUrl),
        externalUrl: cleanUrl(item.externalUrl),
        durationSeconds: item.durationSeconds != null ? Number(item.durationSeconds) : null,
        clips,
        sortOrder: Number(item.sortOrder ?? 0),
        active: item.active === undefined ? true : Number(item.active) === 1,
      };
    })
    .filter((v) => v.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

// ---------------------------------------------------------------------
// Branding + Contact Info (HOMEPAGE ADMIN REBUILD — "Header and branding
// if managed here"). Both tables + their admin CRUD already existed
// (backend/src/modules/content/branding.* and contactInfo.*) but were
// never read by any live page — Header/Footer hardcode the logo image
// and the mock `contact.json`'s (always-empty) social links instead. Same
// fallback contract as every other *Live function in this file: a missing/
// unreachable/not-yet-configured value falls back to the existing default
// so Header/Footer can never render blank or broken because of this.
// ---------------------------------------------------------------------

export interface LiveBranding {
  logoUrl: string | null;
  logoAlt: string | null;
}

export async function getBrandingLive(): Promise<LiveBranding | null> {
  const dto = await backendGet<LiveBranding>("/branding");
  if (!dto || !dto.logoUrl) return null;
  return dto;
}

export interface LiveContactInfo {
  phone: string;
  whatsapp: string;
  email: string | null;
  address: string | null;
  hours: string | null;
  socialLinks: { platform: string; url: string }[];
}

export async function getContactInfoLive(): Promise<LiveContactInfo | null> {
  return backendGet<LiveContactInfo>("/contact-info");
}

// ---------------------------------------------------------------------
// Blog (Blog Management System — requirements 4/6/7). Unlike every read
// above, there is no pre-existing mock blog content to fall back to —
// this is a brand-new feature, not a migration of something that already
// rendered from `src/lib/data/*.json`. A missing/unreachable backend (or
// a backend not yet migrated — `blog_posts` doesn't exist pre-migration)
// simply surfaces as an empty result here; the pages that call these
// functions are responsible for their own empty/error states (requirement
// 4's "useful loading, empty, and error states"), not this file.
// ---------------------------------------------------------------------

export interface LiveBlogCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

export interface LiveBlogTag {
  id: string;
  slug: string;
  name: string;
}

export interface LiveBlogImageRef {
  mediaId: string;
  url: string | null;
  alt: string | null;
}

export interface LiveBlogPostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  featuredImage: LiveBlogImageRef | null;
  category: LiveBlogCategory | null;
  tags: LiveBlogTag[];
  authorName: string;
  publishedAt: string | null;
  readingTimeMinutes: number | null;
}

export interface LiveBlogPostDetail extends LiveBlogPostSummary {
  content: string;
  ogImage: { mediaId: string; url: string | null } | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  relatedPosts: LiveBlogPostSummary[];
}

export interface LiveBlogPostPage {
  items: LiveBlogPostSummary[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Public blog reads go straight to the backend on every call (no
 * `REVALIDATE_SECONDS` in-process cache like `getLiveCatalogContext`'s) —
 * Next's own `fetch` cache (the `next: { revalidate }` option on
 * `backendGet`'s server branch) already gives these the same 30-second
 * ISR-style freshness window every other `*Live` read gets, and a
 * client-side "Load more" click on the listing page must always go
 * through `backendGet`'s browser branch (`cache: "no-store"`) rather than
 * a server-only in-memory cache that a browser call could never populate
 * or benefit from.
 */
export async function listBlogPostsLive(params: {
  categorySlug?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<LiveBlogPostPage> {
  const query = new URLSearchParams();
  if (params.categorySlug) query.set("category", params.categorySlug);
  if (params.search) query.set("search", params.search);
  query.set("page", String(params.page ?? 1));
  query.set("pageSize", String(params.pageSize ?? 9));
  const result = await backendGet<LiveBlogPostPage>(`/blog/posts?${query.toString()}`);
  return result ?? { items: [], total: 0, page: params.page ?? 1, pageSize: params.pageSize ?? 9 };
}

export async function getBlogPostBySlugLive(slug: string): Promise<LiveBlogPostDetail | null> {
  return backendGet<LiveBlogPostDetail>(`/blog/posts/${encodeURIComponent(slug)}`);
}

export async function listBlogCategoriesLive(): Promise<LiveBlogCategory[]> {
  const rows = await backendGet<LiveBlogCategory[]>("/blog/categories");
  return rows ?? [];
}

/** Every published post's slug + dates — `src/app/sitemap.ts` only, see `GET /blog/sitemap-urls`'s own doc comment on the backend. */
export async function listPublishedBlogSlugsLive(): Promise<Array<{ slug: string; updatedAt: string; publishedAt: string | null }>> {
  const rows = await backendGet<Array<{ slug: string; updatedAt: string; publishedAt: string | null }>>("/blog/sitemap-urls");
  return rows ?? [];
}
