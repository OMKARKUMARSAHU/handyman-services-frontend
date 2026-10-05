import { apiRequest, AuthApiError } from "@/lib/auth/api";

/**
 * Customer self-service API — the real data behind the Customer Dashboard
 * (MASTER TASK Bug 3). Every call here hits an endpoint that already
 * existed and already worked (`backend/src/modules/customers/*.routes.ts`,
 * `backend/src/modules/orders/orders.routes.ts`) — this phase's gap was
 * entirely that no frontend code had ever called them; `/account` stayed a
 * placeholder regardless of what the backend could already do. Reuses the
 * same cookie-based `apiRequest` wrapper every other authenticated module
 * uses, not a second fetch client.
 */

export interface CustomerProfile {
  id: string;
  cognitoSub: string;
  name: string;
  phone: string | null;
  email: string | null;
  accountStatus: "active" | "disabled";
}

export interface CustomerAddress {
  id: string;
  customerId: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export type AddressInput = {
  label: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
};

export type OrderStatus = "pending" | "confirmed" | "assigned" | "in_progress" | "completed" | "cancelled";

export interface CustomerOrderItem {
  id: string;
  serviceName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  address: { label: string; line1: string; line2: string | null; city: string; state: string; pincode: string };
  scheduledDate: string;
  scheduledSlot: string | null;
  subtotal: number;
  discountTotal: number;
  total: number;
  status: OrderStatus;
  paymentStatus: string;
  createdAt: string;
  items: CustomerOrderItem[];
}

export { AuthApiError };

export function getMyProfile() {
  return apiRequest<CustomerProfile>("/customer/me", { method: "GET" });
}

export function updateMyProfile(input: { name?: string; phone?: string | null }) {
  return apiRequest<CustomerProfile>("/customer/me", { method: "PATCH", body: JSON.stringify(input) });
}

export function listMyAddresses() {
  return apiRequest<CustomerAddress[]>("/customer/addresses", { method: "GET" });
}

export function createMyAddress(input: AddressInput) {
  return apiRequest<CustomerAddress>("/customer/addresses", { method: "POST", body: JSON.stringify(input) });
}

export function updateMyAddress(id: string, input: Partial<AddressInput>) {
  return apiRequest<CustomerAddress>(`/customer/addresses/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteMyAddress(id: string) {
  return apiRequest<{ deleted: boolean }>(`/customer/addresses/${id}`, { method: "DELETE" });
}

/** First page only (newest first) — enough for a dashboard summary; a full paginated order-history view is a natural follow-up, not invented here. */
export function listMyOrders() {
  return apiRequest<CustomerOrder[]>("/customer/orders?pageSize=20", { method: "GET" });
}

/** First page only -- matches listMyOrders() above. */
export function getMyOrder(orderId: string) {
  return apiRequest<CustomerOrder>(`/customer/orders/${orderId}`, { method: "GET" });
}

export interface CreateOrderInput {
  addressId: string;
  scheduledDate: string;
  scheduledSlot?: string | null;
  /** Client-generated, reused on retry so a double-submit (double-click, a retried network request) can never create two orders for the same checkout attempt. */
  idempotencyKey: string;
}

/**
 * Creates a REAL order from whatever is currently in the customer's SERVER
 * cart (see mergeMyCart below) -- the request body carries no price or
 * total; the backend re-derives every figure itself
 * (backend/src/modules/orders/orders.service.ts createOrder).
 */
export function createMyOrder(input: CreateOrderInput) {
  return apiRequest<CustomerOrder>("/customer/orders", { method: "POST", body: JSON.stringify(input) });
}

// --- Server-side cart (backend/src/modules/cart) ---
// The site's Add to Cart / Cart drawer / Cart page work against a
// browser-local cart for anonymous browsing (CartProvider) -- that is
// deliberate (the backend only persists a cart for a signed-in customer).
// At checkout, once the customer is signed in, the local cart is merged
// into this real server cart via mergeMyCart(), and order creation reads
// ONLY from the server cart from that point on.

export interface CustomerCartItem {
  id: string;
  serviceId: string;
  serviceName: string | null;
  serviceSlug: string | null;
  cityId: string;
  quantity: number;
  unitPriceAtAdd: number;
  currentOfferPrice: number | null;
  priceChanged: boolean;
  isAvailable: boolean;
  mrp: number | null;
  serviceDiscountAmount: number;
  offerDiscountAmount: number;
  totalDiscountAmount: number;
  finalUnitPrice: number;
  lineTotal: number;
}

export interface CustomerCart {
  id: string;
  customerId: string;
  items: CustomerCartItem[];
  subtotal: number;
  hasStaleItems: boolean;
}

export function getMyCart() {
  return apiRequest<CustomerCart>("/customer/cart", { method: "GET" });
}

/** Called once per checkout, right after confirming the customer is signed in, with the browser-local cart's items -- never touches an order. */
export function mergeMyCart(items: { serviceId: string; cityId: string; quantity: number }[]) {
  return apiRequest<CustomerCart>("/customer/cart/merge", { method: "POST", body: JSON.stringify({ items }) });
}

// --- Razorpay payments (TEST MODE), backend/src/modules/payments ---

export interface RazorpayOrderResponse {
  /** Razorpay's PUBLIC key id -- safe to use in the browser, this is not the secret. */
  keyId: string;
  razorpayOrderId: string;
  /** Smallest currency unit (paise) -- what Razorpay Checkout itself expects. */
  amount: number;
  currency: "INR";
  orderId: string;
  orderNumber: string;
}

/** Creates a fresh Razorpay Order for this backend order. Safe to call again for a retry after a cancelled/failed attempt -- each call is its own attempt. */
export function createRazorpayOrder(orderId: string) {
  return apiRequest<RazorpayOrderResponse>(`/customer/orders/${orderId}/payment/razorpay-order`, { method: "POST" });
}

export interface RazorpayVerifyPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

/** The ONLY call that can ever result in the order being marked paid -- the backend independently re-verifies the payment signature before updating anything (never trusts that this call is even being made in good faith). */
export function verifyRazorpayPayment(orderId: string, payload: RazorpayVerifyPayload) {
  return apiRequest<{ paymentStatus: string; orderId: string }>(`/customer/orders/${orderId}/payment/razorpay-verify`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Reports a cancelled/failed attempt (modal dismissed, or Razorpay's own payment.failed event) so it does not sit as "initiated" forever -- can only move that one attempt to "failed", never mark anything paid. */
export function markRazorpayPaymentFailed(orderId: string, razorpayOrderId: string, reason?: string) {
  return apiRequest<{ acknowledged: boolean }>(`/customer/orders/${orderId}/payment/razorpay-failed`, {
    method: "POST",
    body: JSON.stringify({ razorpayOrderId, reason }),
  });
}
