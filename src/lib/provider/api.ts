import { apiRequest, AuthApiError } from "@/lib/auth/api";

/**
 * Service Provider's own-listings read API (MASTER TASK Bug 5 — "Service
 * status"). `GET /provider/listings` already existed
 * (backend/src/modules/providers/providers.routes.ts) and is already gated
 * server-side by `assertProviderApproved()` — a pending/rejected provider
 * gets a 403 from the backend itself if this is ever called, independent
 * of whatever the frontend shows. This dashboard only calls it for an
 * already-`approved` provider, so that path is never exercised here, but
 * the guarantee is the backend's, not this file's.
 */
export { AuthApiError };

export type ListingApprovalStatus = "pending_approval" | "approved" | "rejected";

export interface ProviderListingItem {
  id: string;
  name: string;
  mrp: number;
  offerPrice: number;
  active: boolean;
  approvalStatus: ListingApprovalStatus;
  rejectionReason: string | null;
  createdAt: string;
}

export function listMyListings(): Promise<ProviderListingItem[]> {
  return apiRequest<ProviderListingItem[]>("/provider/listings?pageSize=20", { method: "GET" });
}


// ---- Provider self-service listing CREATE/UPDATE (PROVIDER PANEL AUDIT
// FOLLOW-UP — "My Services/Listings" must let the provider actually
// manage their own catalog, not just view it). POST /provider/listings
// and PATCH /provider/listings/:id already existed, server-side gated by
// `assertProviderApproved()` + `requireOwnership()` on the backend — only
// the frontend connection was missing. ----

export interface ProviderListingInput {
  slug: string;
  productId: string;
  serviceTypeId: string;
  name: string;
  shortDescription: string;
  description: string;
  mrp: number;
  offerPrice: number;
  active?: boolean;
}

export function createMyListing(input: ProviderListingInput): Promise<ProviderListingItem> {
  return apiRequest<ProviderListingItem>("/provider/listings", { method: "POST", body: JSON.stringify(input) });
}

export function updateMyListing(id: string, input: Partial<ProviderListingInput>): Promise<ProviderListingItem> {
  return apiRequest<ProviderListingItem>(`/provider/listings/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}
