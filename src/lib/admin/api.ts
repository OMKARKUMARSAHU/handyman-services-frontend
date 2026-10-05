import { apiRequest, AuthApiError } from "@/lib/auth/api";
import type { ProviderApprovalStatus } from "@/lib/auth/types";

/**
 * Admin-only provider-approval API (FINAL AUTHENTICATION ARCHITECTURE §6/§7
 * — "Admin Dashboard must eventually contain a provider approval area ...
 * at minimum provide the backend foundation for: pending providers,
 * approve, reject, provider status"). Every call here is only ever
 * reachable by a signed-in admin: the backend's `requireRole("admin")`
 * enforces that server-side regardless of what this module does, so there
 * is nothing to duplicate here — this is just a thin typed wrapper, reusing
 * `apiRequest` from `@/lib/auth/api` rather than a second fetch wrapper.
 */
export interface AdminProviderListItem {
  id: string;
  cognitoSub: string;
  name: string;
  email: string | null;
  phone: string | null;
  accountStatus: "active" | "disabled";
  approvalStatus: ProviderApprovalStatus;
  businessName: string | null;
  city: string | null;
  categories: string[];
  yearsExperience: number | null;
  bio: string | null;
  availability: string | null;
  rejectionReason: string | null;
  approvedAt: string | null;
}

export { AuthApiError };

export async function listProviders(params: { approvalStatus?: ProviderApprovalStatus; search?: string } = {}): Promise<AdminProviderListItem[]> {
  const query = new URLSearchParams();
  if (params.approvalStatus) query.set("approvalStatus", params.approvalStatus);
  if (params.search) query.set("search", params.search);
  const qs = query.toString();
  return apiRequest<AdminProviderListItem[]>(`/admin/providers${qs ? `?${qs}` : ""}`, { method: "GET" });
}

export function approveProvider(id: string) {
  return apiRequest<AdminProviderListItem>(`/admin/providers/${id}/approve`, { method: "POST", body: JSON.stringify({}) });
}

export function rejectProvider(id: string, reason?: string) {
  return apiRequest<AdminProviderListItem>(`/admin/providers/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

// ---- Admin Dashboard: customers + orders overviews (MASTER TASK Bug 4) ----
// Both hit endpoints that already existed and worked
// (backend/src/modules/customers/customers.routes.ts,
// backend/src/modules/orders/orders.routes.ts) — only the frontend wiring
// was missing.

export interface AdminCustomerListItem {
  id: string;
  cognitoSub: string;
  name: string;
  phone: string | null;
  email: string | null;
  accountStatus: "active" | "disabled";
}

export function listCustomers(params: { search?: string } = {}): Promise<AdminCustomerListItem[]> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  query.set("pageSize", "20");
  return apiRequest<AdminCustomerListItem[]>(`/admin/customers?${query.toString()}`, { method: "GET" });
}

export function setCustomerAccountStatus(id: string, accountStatus: "active" | "disabled") {
  return apiRequest<AdminCustomerListItem>(`/admin/customers/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ accountStatus }),
  });
}

export type AdminOrderStatus = "pending" | "confirmed" | "assigned" | "in_progress" | "completed" | "cancelled";

export interface AdminOrderListItem {
  id: string;
  orderNumber: string;
  customerId: string;
  address: { label: string; city: string };
  scheduledDate: string;
  total: number;
  status: AdminOrderStatus;
  paymentStatus: string;
  createdAt: string;
}

export function listOrders(params: { status?: AdminOrderStatus } = {}): Promise<AdminOrderListItem[]> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  query.set("pageSize", "20");
  return apiRequest<AdminOrderListItem[]>(`/admin/orders?${query.toString()}`, { method: "GET" });
}

export function setOrderStatus(id: string, status: AdminOrderStatus) {
  return apiRequest<AdminOrderListItem>(`/admin/orders/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export interface AdminOrderStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;
}

/** Real aggregate from the backend (SQL COUNT/SUM over the whole orders table) — not a client-side sum over one paginated page. */
export function getOrderStats(): Promise<AdminOrderStats> {
  return apiRequest<AdminOrderStats>("/admin/orders/stats", { method: "GET" });
}
