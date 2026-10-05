import { randomUUID } from "node:crypto";
import { createCity } from "../../src/modules/cities/cities.service";
import { createCategory } from "../../src/modules/categories/categories.service";
import { createProduct } from "../../src/modules/products/products.service";
import { createServiceType } from "../../src/modules/service-types/service-types.service";
import { approveListing, createService } from "../../src/modules/services/services.service";
import { setServiceCityAvailability } from "../../src/modules/availability/availability.service";
import { createOffer, type UpsertOfferInput } from "../../src/modules/offers/offers.service";
import type { CreatedByRole } from "../../src/modules/services/services.types";
import type { ManagedServiceDto } from "../../src/modules/services/services.types";
import type { CityDto } from "../../src/modules/cities/cities.types";
import type { OfferDto } from "../../src/modules/offers/offers.types";

/** Minimal, valid catalog fixture tree: one city, one category, one product, one service type. */
export async function seedCatalogBasics() {
  const unique = randomUUID().slice(0, 8);
  const city = await createCity({ name: "Test City", state: "Test State", slug: `test-city-${unique}` });
  const category = await createCategory({
    slug: `test-category-${unique}`,
    name: "Test Category",
    description: "A category used only in tests.",
    icon: "wrench",
  });
  const product = await createProduct({
    categoryId: category.id,
    slug: `test-product-${unique}`,
    name: "Test Product",
    description: "A product used only in tests.",
    icon: "wrench",
  });
  const serviceType = await createServiceType({ key: `test-type-${unique}`, label: "Test Type" });
  return { city, category, product, serviceType };
}

export interface SeededServiceOptions {
  productId: string;
  serviceTypeId: string;
  cityId?: string;
  mrp?: number;
  offerPrice?: number;
  createdByRole?: CreatedByRole;
  createdByUserId?: string;
  approve?: boolean;
}

/** Creates a listing through the real `createService()` (so it always starts `pending_approval`, matching production behavior), optionally approves it and makes it available in a city. */
export async function seedService(options: SeededServiceOptions): Promise<ManagedServiceDto> {
  const unique = randomUUID().slice(0, 8);
  const createdByRole = options.createdByRole ?? "provider";
  const createdByUserId = options.createdByUserId ?? randomUUID();

  let service = await createService(
    {
      slug: `test-service-${unique}`,
      productId: options.productId,
      serviceTypeId: options.serviceTypeId,
      name: "Test Service",
      shortDescription: "A short description.",
      description: "A longer description used only in tests.",
      whatsIncluded: ["Item A", "Item B"],
      mrp: options.mrp ?? 1000,
      offerPrice: options.offerPrice ?? 800,
    },
    createdByRole,
    createdByUserId
  );

  if (options.cityId) {
    await setServiceCityAvailability(service.id, [{ cityId: options.cityId, active: true }]);
  }

  if (options.approve ?? true) {
    service = await approveListing(service.id, randomUUID());
  }

  return service;
}

export async function seedApprovedServiceInCity(city: CityDto, productId: string, serviceTypeId: string) {
  return seedService({ productId, serviceTypeId, cityId: city.id, approve: true });
}

/** Minimal, valid Offer fixture — ALL_INDIA by default, `all` scope, active, no date range. Override anything via `overrides`. */
export async function seedOffer(overrides: Partial<UpsertOfferInput> = {}): Promise<OfferDto> {
  const unique = randomUUID().slice(0, 8);
  return createOffer({
    title: `Test Offer ${unique}`,
    description: "An offer used only in tests.",
    discountType: "flat",
    discountValue: 100,
    applicabilityType: "all_india",
    cityId: null,
    appliesTo: { scope: "all", ids: [] },
    active: true,
    ...overrides,
  });
}
