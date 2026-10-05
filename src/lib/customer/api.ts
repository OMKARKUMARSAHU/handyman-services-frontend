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
  address: { label: string; line1: string; city: string };
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
