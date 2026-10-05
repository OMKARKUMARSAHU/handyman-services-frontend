import { apiRequest, AuthApiError } from "@/lib/auth/api";

/**
 * Admin Catalog Management API client (AUDIT FOLLOW-UP — "Catalog
 * management is coming soon"). Every endpoint here already existed and
 * already worked on the backend (cities/categories/products/service-types/
 * services/offers/media modules, each independently `requireRole("admin")`-
 * gated) — this module's only job is giving the Admin Catalog UI a typed
 * way to call them, the same thin-wrapper pattern as `@/lib/admin/api`.
 * Nothing here invents a capability the backend doesn't already enforce.
 */
export { AuthApiError };

// ---- Cities ----

export interface AdminCity {
  id: string;
  name: string;
  state: string;
  slug: string;
  isPopular: boolean;
  active: boolean;
  sortOrder: number;
  iconUrl: string | null;
  iconAlt: string | null;
}

export interface CityInput {
  name: string;
  state: string;
  slug: string;
  isPopular?: boolean;
  active?: boolean;
  sortOrder?: number;
  iconUrl?: string | null;
  iconAlt?: string | null;
}

// ADMIN CMS FOLLOW-UP: was the public `/cities` (active-only), so a
// disabled city vanished from Admin's own list with no way back. Now
// hits the admin-gated, unrestricted `/admin/cities`.
export function listCitiesAdmin(): Promise<AdminCity[]> {
  return apiRequest<AdminCity[]>("/admin/cities", { method: "GET" });
}

export function createCity(input: CityInput): Promise<AdminCity> {
  return apiRequest<AdminCity>("/admin/cities", { method: "POST", body: JSON.stringify(input) });
}

export function updateCity(id: string, input: Partial<CityInput>): Promise<AdminCity> {
  return apiRequest<AdminCity>(`/admin/cities/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

// ---- Categories ----

export interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  image: string | null;
  sortOrder: number;
  active: boolean;
}

export interface CategoryInput {
  slug: string;
  name: string;
  description: string;
  icon: string;
  image?: string | null;
  sortOrder?: number;
  active?: boolean;
}

// ADMIN CMS FOLLOW-UP: was the public `/categories` (active-only) -- see
// the identical note on `listCitiesAdmin()` above.
export function listCategoriesAdmin(): Promise<AdminCategory[]> {
  return apiRequest<AdminCategory[]>("/admin/categories", { method: "GET" });
}

export function createCategory(input: CategoryInput): Promise<AdminCategory> {
  return apiRequest<AdminCategory>("/admin/categories", { method: "POST", body: JSON.stringify(input) });
}

export function updateCategory(id: string, input: Partial<CategoryInput>): Promise<AdminCategory> {
  return apiRequest<AdminCategory>(`/admin/categories/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

// ---- Products ----

export interface AdminProduct {
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

export interface ProductInput {
  categoryId: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  image?: string | null;
  sortOrder?: number;
  active?: boolean;
}

/**
 * ADMIN CMS FOLLOW-UP: this used to call the public, active-only
 * `/categories/:slug/products` -- a product disabled from Admin would
 * disappear from this very list, with no way to find it again to
 * re-enable it. Now calls the admin-gated `/admin/categories/:slug/
 * products`, which returns active AND inactive products.
 */
export function listProductsByCategorySlug(categorySlug: string): Promise<AdminProduct[]> {
  return apiRequest<AdminProduct[]>(`/admin/categories/${categorySlug}/products`, { method: "GET" });
}

export function createProduct(input: ProductInput): Promise<AdminProduct> {
  return apiRequest<AdminProduct>("/admin/products", { method: "POST", body: JSON.stringify(input) });
}

export function updateProduct(id: string, input: Partial<ProductInput>): Promise<AdminProduct> {
  return apiRequest<AdminProduct>(`/admin/products/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

// ---- Service Types ----

export interface AdminServiceType {
  id: string;
  key: string;
  label: string;
  sortOrder: number;
  active: boolean;
}

export interface ServiceTypeInput {
  key: string;
  label: string;
  sortOrder?: number;
  active?: boolean;
}

// ADMIN CMS FOLLOW-UP: was the public `/service-types` (active-only) --
// see the identical note on `listCitiesAdmin()` above.
export function listServiceTypesAdmin(): Promise<AdminServiceType[]> {
  return apiRequest<AdminServiceType[]>("/admin/service-types", { method: "GET" });
}

export function createServiceType(input: ServiceTypeInput): Promise<AdminServiceType> {
  return apiRequest<AdminServiceType>("/admin/service-types", { method: "POST", body: JSON.stringify(input) });
}

export function updateServiceType(id: string, input: Partial<ServiceTypeInput>): Promise<AdminServiceType> {
  return apiRequest<AdminServiceType>(`/admin/service-types/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

// ---- Services (listings) ----

export type ApprovalStatus = "pending_approval" | "approved" | "rejected";

export interface AdminOfferSummary {
  id: string;
  title: string;
  discountType: "percent" | "flat";
  discountValue: number;
  applicabilityType: "all_india" | "city";
  cityId: string | null;
}

export interface AdminServiceImage {
  id: string;
  serviceId: string;
  url: string;
  alt: string;
  sortOrder: number;
}

export interface AdminService {
  id: string;
  slug: string;
  productId: string;
  serviceTypeId: string;
  name: string;
  shortDescription: string;
  description: string;
  whatsIncluded: string[];
  images: AdminServiceImage[];
  mrp: number;
  offerPrice: number;
  discountPercent: number;
  discountAmount: number;
  effectiveOffer: AdminOfferSummary | null;
  offerDiscountAmount: number;
  totalDiscountAmount: number;
  finalPrice: number;
  ratingAverage: number | null;
  ratingCount: number;
  isMostBooked: boolean;
  availableCityIds: string[];
  featured: boolean;
  active: boolean;
  sortOrder: number;
  approvalStatus: ApprovalStatus;
  rejectionReason: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  createdByRole: "admin" | "provider";
  createdByUserId: string;
  createdAt: string;
}

export interface ServiceInput {
  slug: string;
  productId: string;
  serviceTypeId: string;
  name: string;
  shortDescription: string;
  description: string;
  whatsIncluded?: string[];
  mrp: number;
  offerPrice: number;
  featured?: boolean;
  isMostBooked?: boolean;
  active?: boolean;
  sortOrder?: number;
}

/**
 * Admin has no single "list every service" endpoint by design (catalog
 * listings are approval-gated) — `/admin/listings/pending` is the one
 * admin-only listing-queue endpoint and, despite its path, accepts a
 * `status` filter for all three approval states, which is exactly what a
 * management view needs: pending/approved/rejected, not just "pending".
 */
export function listServicesAdmin(params: { status?: ApprovalStatus } = {}): Promise<AdminService[]> {
  const query = new URLSearchParams();
  query.set("status", params.status ?? "approved");
  query.set("pageSize", "100");
  return apiRequest<AdminService[]>(`/admin/listings/pending?${query.toString()}`, { method: "GET" });
}

export function createService(input: ServiceInput): Promise<AdminService> {
  return apiRequest<AdminService>("/admin/services", { method: "POST", body: JSON.stringify(input) });
}

export function updateService(id: string, input: Partial<ServiceInput>): Promise<AdminService> {
  return apiRequest<AdminService>(`/admin/services/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function setServiceCityAvailability(
  id: string,
  cities: { cityId: string; active: boolean }[]
): Promise<{ serviceId: string; availableCityIds: string[] }> {
  return apiRequest(`/admin/services/${id}/city-availability`, { method: "PUT", body: JSON.stringify({ cities }) });
}

export function approveListing(id: string): Promise<AdminService> {
  return apiRequest<AdminService>(`/admin/listings/${id}/approve`, { method: "POST", body: JSON.stringify({}) });
}

export function rejectListing(id: string, reason: string): Promise<AdminService> {
  return apiRequest<AdminService>(`/admin/listings/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) });
}

// ---- Offers ----

export type OfferDiscountType = "percent" | "flat";
export type OfferScope = "all" | "category" | "service";
export type OfferApplicabilityType = "all_india" | "city";

export interface AdminOffer {
  id: string;
  title: string;
  description: string;
  discountType: OfferDiscountType;
  discountValue: number;
  applicabilityType: OfferApplicabilityType;
  cityId: string | null;
  appliesTo: { scope: OfferScope; ids: string[] };
  bannerImage: string | null;
  startDate: string | null;
  endDate: string | null;
  active: boolean;
}

export interface OfferInput {
  title: string;
  description: string;
  discountType: OfferDiscountType;
  discountValue: number;
  applicabilityType: OfferApplicabilityType;
  cityId?: string | null;
  appliesTo: { scope: OfferScope; ids: string[] };
  bannerImage?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  active?: boolean;
}

export function listOffersAdmin(params: { applicabilityType?: OfferApplicabilityType; cityId?: string } = {}): Promise<AdminOffer[]> {
  const query = new URLSearchParams();
  if (params.applicabilityType) query.set("applicabilityType", params.applicabilityType);
  if (params.cityId) query.set("cityId", params.cityId);
  query.set("pageSize", "100");
  return apiRequest<AdminOffer[]>(`/admin/offers?${query.toString()}`, { method: "GET" });
}

export function createOffer(input: OfferInput): Promise<AdminOffer> {
  return apiRequest<AdminOffer>("/admin/offers", { method: "POST", body: JSON.stringify(input) });
}

export function updateOffer(id: string, input: Partial<OfferInput>): Promise<AdminOffer> {
  return apiRequest<AdminOffer>(`/admin/offers/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

// ---- Media (generic CMS uploads: category/product/city images, offer
// banners, homepage-section images, video-curation thumbnails/clips) ----

export function createCmsUploadUrl(input: {
  entityType: "category" | "product" | "city" | "offer" | "homepage" | "branding";
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
}): Promise<{ uploadUrl: string; key: string; publicUrl: string; expiresAt: string }> {
  return apiRequest("/admin/media/cms-upload-url", { method: "POST", body: JSON.stringify(input) });
}

/** Uploads one file through the CMS presign flow and returns its public URL, ready to save onto whichever entity field it belongs to (category.image, city.iconUrl, offer.bannerImage, a homepage-section item's thumbnail/videoUrl, etc). */
export async function uploadCmsFile(
  entityType: "category" | "product" | "city" | "offer" | "homepage" | "branding",
  file: File
): Promise<string> {
  const { uploadUrl, publicUrl } = await createCmsUploadUrl({
    entityType,
    fileName: file.name,
    contentType: file.type,
    fileSizeBytes: file.size,
  });
  const putRes = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
  if (!putRes.ok) throw new Error(`Upload to storage failed (${putRes.status}).`);
  return publicUrl;
}

// ---- Media (per-service images) ----

export function createMediaUploadUrl(input: {
  serviceId: string;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
}): Promise<{ uploadUrl: string; key: string; expiresAt: string }> {
  return apiRequest("/media/upload-url", { method: "POST", body: JSON.stringify(input) });
}

export function attachServiceImage(
  serviceId: string,
  input: { key: string; alt: string; sortOrder?: number }
): Promise<AdminServiceImage> {
  return apiRequest<AdminServiceImage>(`/media/${serviceId}/images`, { method: "POST", body: JSON.stringify(input) });
}

// ADMIN CMS FOLLOW-UP ("Reorder images / Set primary image").
export function updateServiceImage(
  imageId: string,
  input: { sortOrder?: number; alt?: string }
): Promise<AdminServiceImage> {
  return apiRequest<AdminServiceImage>(`/media/images/${imageId}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteServiceImage(imageId: string): Promise<{ success: boolean }> {
  return apiRequest(`/media/images/${imageId}`, { method: "DELETE" });
}
