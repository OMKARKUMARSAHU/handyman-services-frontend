import servicesData from "@/data/services.json";
import availabilityData from "@/data/serviceCityAvailability.json";
import type { Service, ServiceCityAvailability } from "@/types";
import { withDiscount } from "@/lib/pricing";
import { getAllProductsSync } from "@/lib/data/products";

/**
 * Phase 3 final-polish pass (item 3): every `Service.mrp`/`offerPrice` in
 * `services.json` is demo/mock pricing (illustrative, not client-confirmed
 * final pricing — see also `categories.ts`'s matching catalog note). No UI
 * in this codebase labels a price as "final" or "confirmed", so nothing
 * needed to change there; this comment documents the data's actual status
 * for whoever wires in real pricing later. `discountPercent`/`discountAmount`
 * are still derived at read time from those two mock fields (`lib/pricing.ts`)
 * and will keep working unchanged once real prices replace the mock ones.
 */
type RawService = Omit<Service, "discountPercent" | "discountAmount" | "availableCityIds">;

function availableCityIdsFor(serviceId: string): string[] {
  return (availabilityData as ServiceCityAvailability[])
    .filter((a) => a.serviceId === serviceId && a.active)
    .map((a) => a.cityId);
}

function hydrate(raw: RawService): Service {
  return withDiscount({
    ...raw,
    availableCityIds: availableCityIdsFor(raw.id),
  }) as Service;
}

function allServices(): Service[] {
  return (servicesData as RawService[]).filter((s) => s.active).map(hydrate);
}

export async function getServicesByProduct(
  productId: string,
  opts?: { cityId?: string; serviceTypeId?: string }
): Promise<Service[]> {
  let services = allServices().filter((s) => s.productId === productId);
  if (opts?.serviceTypeId) {
    services = services.filter((s) => s.serviceTypeId === opts.serviceTypeId);
  }
  if (opts?.cityId) {
    const cityId = opts.cityId;
    services = services.filter((s) => s.availableCityIds.includes(cityId));
  }
  return services.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getServiceBySlug(
  slug: string,
  opts?: { cityId?: string }
): Promise<Service | null> {
  const service = allServices().find((s) => s.slug === slug);
  if (!service) return null;
  if (opts?.cityId && !service.availableCityIds.includes(opts.cityId)) return null;
  return service;
}

/** Homepage "New & Noteworthy" rail — data-driven via Service.featured, not hardcoded. */
export async function getFeaturedServices(cityId?: string): Promise<Service[]> {
  let services = allServices().filter((s) => s.featured);
  if (cityId) services = services.filter((s) => s.availableCityIds.includes(cityId));
  return services;
}

/**
 * Homepage "Most Booked Services" rail. Per the client-approved homepage
 * redesign decision (2026-09-20), this is driven by the Admin-curated
 * `Service.isMostBooked` flag — deliberately NOT a computed ranking, since
 * no real order/booking-volume data exists in Phase 3 (mock JSON only,
 * PHASE_2_OPEN_QUESTIONS.md #18). Replaces the earlier Phase 3 stub that
 * intentionally returned `[]` before this flag was approved.
 */
export async function getMostBookedServices(cityId?: string): Promise<Service[]> {
  let services = allServices().filter((s) => s.isMostBooked);
  if (cityId) services = services.filter((s) => s.availableCityIds.includes(cityId));
  return services;
}

/**
 * Homepage/city-homepage "category-wise service rails" — one rail per
 * Category, each listing that category's services (via their Product's
 * categoryId), scoped to a city when given. `limit` bounds each rail's
 * card count (the rail itself is a discovery teaser, not the full catalog —
 * the full list is the category/product browsing pages).
 */
export async function getServicesByCategory(
  categoryId: string,
  opts?: { cityId?: string; limit?: number }
): Promise<Service[]> {
  const productIds = new Set(
    getAllProductsSync()
      .filter((p) => p.categoryId === categoryId)
      .map((p) => p.id)
  );
  let services = allServices().filter((s) => productIds.has(s.productId));
  if (opts?.cityId) {
    const cityId = opts.cityId;
    services = services.filter((s) => s.availableCityIds.includes(cityId));
  }
  services = services.sort((a, b) => a.sortOrder - b.sortOrder);
  return opts?.limit ? services.slice(0, opts.limit) : services;
}

export function getServiceByIdSync(id: string): Service | undefined {
  return allServices().find((s) => s.id === id);
}

export function getAllServicesSync(): Service[] {
  return allServices();
}

export function getServiceBySlugSync(slug: string): Service | undefined {
  return allServices().find((s) => s.slug === slug);
}

// --- Sync variants -----------------------------------------------------
// The three functions above (getFeaturedServices/getMostBookedServices/
// getServicesByCategory) are `async` for API-contract compatibility with a
// future real backend, but the underlying read is synchronous mock-JSON
// filtering. The city-agnostic homepage ("/") needs these client-side (it
// only learns the visitor's city from LocationProvider's client-only
// `lastCitySlug`, not at server-render time — see HomeDiscoveryRails),
// where calling an async DAL function would mean an extra render pass /
// loading flicker for data that's already in memory. These sync twins
// exist for that one caller; server components should keep using the
// async versions above.
export function getFeaturedServicesSync(cityId?: string): Service[] {
  let services = allServices().filter((s) => s.featured);
  if (cityId) services = services.filter((s) => s.availableCityIds.includes(cityId));
  return services;
}

export function getMostBookedServicesSync(cityId?: string): Service[] {
  let services = allServices().filter((s) => s.isMostBooked);
  if (cityId) services = services.filter((s) => s.availableCityIds.includes(cityId));
  return services;
}

export function getServicesByCategorySync(
  categoryId: string,
  opts?: { cityId?: string; limit?: number }
): Service[] {
  const productIds = new Set(
    getAllProductsSync()
      .filter((p) => p.categoryId === categoryId)
      .map((p) => p.id)
  );
  let services = allServices().filter((s) => productIds.has(s.productId));
  if (opts?.cityId) {
    const cityId = opts.cityId;
    services = services.filter((s) => s.availableCityIds.includes(cityId));
  }
  services = services.sort((a, b) => a.sortOrder - b.sortOrder);
  return opts?.limit ? services.slice(0, opts.limit) : services;
}
