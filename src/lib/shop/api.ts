import { apiRequest } from "@/lib/auth/api";
import { DIRECT_BACKEND_BASE_URL } from "@/lib/server/backend-url";
import { requestPaged, toQuery } from "./http";
import type {
  PageMeta,
  ShopCartPricing,
  ShopCategory,
  ShopOrder,
  ShopProductDetail,
  ShopProductSummary,
  ShopRazorpayOrder,
} from "./types";

/**
 * Public, server-rendered readers for the Products pages (ISR-style 30s cache,
 * like @/lib/data/live). They return `null` / empty on any failure so a page
 * can show a friendly empty state instead of crashing when the backend is
 * unreachable. Draft / inactive products are never returned by the backend, so
 * nothing here can leak one.
 */
const REVALIDATE_SECONDS = 30;

async function publicGet<T>(path: string): Promise<{ data: T; meta?: PageMeta } | null> {
  try {
    const res = await fetch(`${DIRECT_BACKEND_BASE_URL}${path}`, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) {
      warnShopFetch(path, `HTTP ${res.status}`, await res.json().catch(() => null));
      return null;
    }
    const body = (await res.json().catch(() => null)) as { success?: boolean; data?: T; meta?: PageMeta } | null;
    if (!body || body.success === false || body.data === undefined) return null;
    return { data: body.data, meta: body.meta };
  } catch (err) {
    warnShopFetch(path, "request failed", { message: (err as Error)?.message, cause: (err as { cause?: { code?: string } })?.cause?.code });
    return null;
  }
}

/**
 * The shop readers degrade to "no products" so a backend problem can never break a public page — but that
 * must not be silent: the Next.js terminal says exactly why (backend down = ECONNREFUSED, DATABASE_NOT_MIGRATED
 * = migrations 20/21 not applied to the connected database, ...).
 */
function warnShopFetch(path: string, what: string, detail: unknown): void {
  const code = (detail as { error?: { code?: string } } | null)?.error?.code;
  console.warn(`[shop] GET ${DIRECT_BACKEND_BASE_URL}${path} -> ${what}${code ? ` (${code})` : ""}`, code ? "" : detail ?? "");
}

export interface ProductListQuery {
  search?: string;
  category?: string;
  sort?: "newest" | "oldest" | "price_asc" | "price_desc";
  inStock?: boolean;
  featured?: boolean;
  /** City slug: hides products unavailable there and applies city prices. */
  city?: string;
  page?: number;
  pageSize?: number;
}

export async function getShopCategoriesLive(): Promise<ShopCategory[]> {
  return (await publicGet<ShopCategory[]>("/shop/categories"))?.data ?? [];
}

export async function getShopProductsLive(q: ProductListQuery): Promise<{ items: ShopProductSummary[]; meta: PageMeta; ok: boolean }> {
  const query = toQuery({ ...q, inStock: q.inStock ? "true" : undefined, featured: q.featured ? "true" : undefined });
  const res = await publicGet<ShopProductSummary[]>(`/shop/products${query}`);
  if (!res) return { items: [], meta: { page: 1, pageSize: q.pageSize ?? 12, total: 0, totalPages: 1 }, ok: false };
  return { items: res.data, meta: res.meta ?? { page: 1, pageSize: res.data.length, total: res.data.length, totalPages: 1 }, ok: true };
}

export async function getShopProductLive(slug: string): Promise<{ product: ShopProductDetail; related: ShopProductSummary[] } | null> {
  return (await publicGet<{ product: ShopProductDetail; related: ShopProductSummary[] }>(`/shop/products/${encodeURIComponent(slug)}`))?.data ?? null;
}

// ---- Browser-side, city-aware readers (the city lives in the browser, so server-cached pages
// render the base-price view and these refine it once the visitor's city is known).
export async function fetchShopProductsForCity(q: ProductListQuery, init?: RequestInit) {
  const query = toQuery({ ...q, inStock: q.inStock ? "true" : undefined, featured: q.featured ? "true" : undefined });
  return requestPaged<ShopProductSummary[]>(`/shop/products${query}`, init);
}

export function fetchShopProductForCity(slug: string, city: string) {
  return apiRequest<{ product: ShopProductDetail; related: ShopProductSummary[] }>(`/shop/products/${encodeURIComponent(slug)}${toQuery({ city })}`);
}

export async function getShopSitemapData(): Promise<{ categories: Array<{ slug: string }>; products: Array<{ slug: string; updatedAt: string }> }> {
  return (await publicGet<{ categories: Array<{ slug: string }>; products: Array<{ slug: string; updatedAt: string }> }>("/shop/sitemap-data"))?.data ?? { categories: [], products: [] };
}

export async function getShopPublicSettingsLive(): Promise<{ deliveryCharge: number; freeDeliveryThreshold: number | null }> {
  return (await publicGet<{ deliveryCharge: number; freeDeliveryThreshold: number | null }>("/shop/settings/public"))?.data ?? { deliveryCharge: 0, freeDeliveryThreshold: null };
}

// ---------------------------------------------------------------------------
// Browser-side calls (cookie session, same-origin proxy)
// ---------------------------------------------------------------------------

export function priceShopCart(items: Array<{ productId: string; quantity: number }>, city?: string | null) {
  return apiRequest<ShopCartPricing>("/shop/cart/price", { method: "POST", body: JSON.stringify({ items, ...(city ? { city } : {}) }) });
}

export function createShopOrder(input: { items: Array<{ productId: string; quantity: number }>; addressId: string; idempotencyKey: string; city: string }) {
  return apiRequest<ShopOrder>("/customer/shop/orders", { method: "POST", body: JSON.stringify(input) });
}

export function listMyShopOrders(page = 1) {
  return requestPaged<ShopOrder[]>(`/customer/shop/orders${toQuery({ page, pageSize: 10 })}`);
}

export function getMyShopOrder(id: string) {
  return apiRequest<ShopOrder>(`/customer/shop/orders/${id}`);
}

export function cancelMyShopOrder(id: string) {
  return apiRequest<ShopOrder>(`/customer/shop/orders/${id}/cancel`, { method: "POST" });
}

export function createShopRazorpayOrder(orderId: string) {
  return apiRequest<ShopRazorpayOrder>(`/customer/shop/orders/${orderId}/payment/razorpay-order`, { method: "POST" });
}

export function verifyShopRazorpayPayment(orderId: string, payload: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
  return apiRequest<{ paymentStatus: "paid"; orderId: string }>(`/customer/shop/orders/${orderId}/payment/razorpay-verify`, { method: "POST", body: JSON.stringify(payload) });
}

export function markShopPaymentFailed(orderId: string, razorpayOrderId: string) {
  return apiRequest<{ acknowledged: boolean }>(`/customer/shop/orders/${orderId}/payment/razorpay-failed`, { method: "POST", body: JSON.stringify({ razorpayOrderId }) });
}
