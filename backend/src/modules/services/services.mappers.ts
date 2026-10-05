import { computeFinalPricing } from "../../shared/pricing";
import type { OfferDto } from "../offers/offers.types";
import type { ManagedServiceDto, PublicServiceDto, ServiceRow } from "./services.types";

export interface ServiceImageRow {
  id: string;
  service_id: string;
  url: string;
  alt: string;
  sort_order: number;
}

function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function toImages(rows: ServiceImageRow[]) {
  return rows
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => ({ id: r.id, serviceId: r.service_id, url: r.url, alt: r.alt, sortOrder: r.sort_order }));
}

export function toPublicServiceDto(
  row: ServiceRow,
  images: ServiceImageRow[],
  availableCityIds: string[],
  effectiveOffer: OfferDto | null = null
): PublicServiceDto {
  const mrp = Number(row.mrp);
  const offerPrice = Number(row.offer_price);
  const pricing = computeFinalPricing(mrp, offerPrice, effectiveOffer);

  return {
    id: row.id,
    slug: row.slug,
    productId: row.product_id,
    serviceTypeId: row.service_type_id,
    name: row.name,
    shortDescription: row.short_description,
    description: row.description,
    whatsIncluded: parseJsonColumn<string[]>(row.whats_included, []),
    images: toImages(images),
    mrp,
    offerPrice,
    discountPercent: pricing.serviceDiscountPercent,
    discountAmount: pricing.serviceDiscountAmount,
    effectiveOffer,
    offerDiscountAmount: pricing.offerDiscountAmount,
    totalDiscountAmount: pricing.totalDiscountAmount,
    finalPrice: pricing.finalPrice,
    ratingAverage: row.rating_average === null ? null : Number(row.rating_average),
    ratingCount: row.rating_count,
    isMostBooked: Boolean(row.is_most_booked),
    availableCityIds,
    featured: Boolean(row.featured),
    active: Boolean(row.active),
    sortOrder: row.sort_order,
  };
}

export function toManagedServiceDto(
  row: ServiceRow,
  images: ServiceImageRow[],
  availableCityIds: string[]
): ManagedServiceDto {
  return {
    ...toPublicServiceDto(row, images, availableCityIds),
    approvalStatus: row.approval_status,
    rejectionReason: row.rejection_reason,
    approvedByUserId: row.approved_by_user_id,
    approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null,
    createdByRole: row.created_by_role,
    createdByUserId: row.created_by_user_id,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
