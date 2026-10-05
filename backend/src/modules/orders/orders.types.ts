import type { OfferApplicabilityType } from "../offers/offers.types";

export type OrderStatus = "pending" | "confirmed" | "assigned" | "in_progress" | "completed" | "cancelled";

export interface OrderRow {
  id: string;
  order_number: string;
  customer_id: string;
  address_label: string;
  address_line1: string;
  address_line2: string | null;
  address_city: string;
  address_state: string;
  address_pincode: string;
  scheduled_date: string | Date;
  scheduled_slot: string | null;
  subtotal: string;
  discount_total: string;
  total: string;
  status: OrderStatus;
  provider_id: string | null;
  payment_status: string;
  idempotency_key: string;
  created_at: string | Date;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  service_id: string;
  service_name_snapshot: string;
  quantity: number;
  /** PHASE 3 CORRECTION — snapshot of mrp/service-offer-price/service-discount at order time, independent of `unit_price` below (which is the FINAL, offer-inclusive price). */
  mrp_snapshot: string;
  service_offer_price_snapshot: string;
  service_discount_amount: string;
  /** Nullable FK, ON DELETE SET NULL — the LINK can be lost if the Offer is ever deleted, but the name/applicability snapshots below never are. */
  effective_offer_id: string | null;
  effective_offer_name_snapshot: string | null;
  effective_offer_applicability_type_snapshot: OfferApplicabilityType | null;
  offer_discount_amount: string;
  total_discount_amount: string;
  /** The FINAL price actually charged per unit (service discount + offer discount already applied) — unchanged field name/meaning from before this correction. */
  unit_price: string;
  line_total: string;
}

export interface OrderItemEffectiveOfferDto {
  /** The offer's current id, or null if it has since been deleted — the name/applicabilityType below are preserved either way. */
  id: string | null;
  name: string;
  applicabilityType: OfferApplicabilityType;
}

export interface OrderItemDto {
  id: string;
  serviceId: string;
  serviceName: string;
  quantity: number;
  mrp: number;
  serviceOfferPrice: number;
  serviceDiscountAmount: number;
  effectiveOffer: OrderItemEffectiveOfferDto | null;
  offerDiscountAmount: number;
  totalDiscountAmount: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderAddressDto {
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
}

export interface OrderDto {
  id: string;
  orderNumber: string;
  customerId: string;
  address: OrderAddressDto;
  scheduledDate: string;
  scheduledSlot: string | null;
  subtotal: number;
  discountTotal: number;
  total: number;
  status: OrderStatus;
  providerId: string | null;
  paymentStatus: string;
  createdAt: string;
  items: OrderItemDto[];
}

export function toOrderItemDto(row: OrderItemRow): OrderItemDto {
  return {
    id: row.id,
    serviceId: row.service_id,
    serviceName: row.service_name_snapshot,
    quantity: row.quantity,
    mrp: Number(row.mrp_snapshot),
    serviceOfferPrice: Number(row.service_offer_price_snapshot),
    serviceDiscountAmount: Number(row.service_discount_amount),
    effectiveOffer: row.effective_offer_name_snapshot
      ? {
          id: row.effective_offer_id,
          name: row.effective_offer_name_snapshot,
          applicabilityType: row.effective_offer_applicability_type_snapshot!,
        }
      : null,
    offerDiscountAmount: Number(row.offer_discount_amount),
    totalDiscountAmount: Number(row.total_discount_amount),
    unitPrice: Number(row.unit_price),
    lineTotal: Number(row.line_total),
  };
}

export function toOrderDto(row: OrderRow, items: OrderItemRow[]): OrderDto {
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerId: row.customer_id,
    address: {
      label: row.address_label,
      line1: row.address_line1,
      line2: row.address_line2,
      city: row.address_city,
      state: row.address_state,
      pincode: row.address_pincode,
    },
    scheduledDate:
      row.scheduled_date instanceof Date ? row.scheduled_date.toISOString().slice(0, 10) : String(row.scheduled_date),
    scheduledSlot: row.scheduled_slot,
    subtotal: Number(row.subtotal),
    discountTotal: Number(row.discount_total),
    total: Number(row.total),
    status: row.status,
    providerId: row.provider_id,
    paymentStatus: row.payment_status,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
    items: items.map(toOrderItemDto),
  };
}
