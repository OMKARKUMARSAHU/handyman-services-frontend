import { apiRequest, AuthApiError } from "@/lib/auth/api";
import { requestPaged, toQuery } from "@/lib/shop/http";
import type {
  PageMeta,
  ShopAdminOrder,
  ShopAdminProduct,
  ShopAdminProductCity,
  ShopCategory,
  ShopCityPricing,
  ShopOverview,
  ShopSettings,
  ShopSpecification,
} from "@/lib/shop/types";

/**
 * Admin Shop API client — typed wrapper over `/admin/shop/*`
 * (backend/src/modules/shop/shop.routes.ts). Every endpoint is independently
 * guarded by `requireRole("admin")` server-side; nothing here carries authority.
 */
export { AuthApiError };

export interface AdminProductInput {
  categoryId: string;
  name: string;
  slug?: string;
  sku: string;
  shortDescription?: string | null;
  description?: string | null;
  price: number;
  mrp?: number | null;
  stockQuantity: number;
  lowStockThreshold?: number;
  trackInventory?: boolean;
  status?: "draft" | "published";
  active?: boolean;
  featured?: boolean;
  specifications?: ShopSpecification[];
  compatibleModels?: string[];
  deliveryInfo?: string | null;
  returnInfo?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export interface AdminCategoryInput {
  name?: string;
  slug?: string;
  description?: string | null;
  imageUrl?: string | null;
  active?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export interface AdminProductListQuery {
  search?: string;
  categoryId?: string;
  status?: "draft" | "published";
  active?: boolean;
  lowStock?: boolean;
  page?: number;
  pageSize?: number;
}

export type AdminVideoInput =
  | { kind: "youtube"; url: string; title?: string | null }
  | { kind: "upload"; mediaId: string; title?: string | null };

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

export const getShopOverview = () => apiRequest<ShopOverview>("/admin/shop/overview");

// settings
export const getAdminShopSettings = () => apiRequest<ShopSettings>("/admin/shop/settings");
export const updateAdminShopSettings = (input: Partial<ShopSettings>) =>
  apiRequest<ShopSettings>("/admin/shop/settings", { method: "PUT", ...json(input) });
export const seedShopDemoData = () =>
  apiRequest<{ categoriesCreated: number; productsCreated: number }>("/admin/shop/seed-demo", { method: "POST" });

// categories
export const listAdminShopCategories = () => apiRequest<ShopCategory[]>("/admin/shop/categories");
export const createAdminShopCategory = (input: AdminCategoryInput & { name: string }) =>
  apiRequest<ShopCategory>("/admin/shop/categories", { method: "POST", ...json(input) });
export const updateAdminShopCategory = (id: string, input: AdminCategoryInput) =>
  apiRequest<ShopCategory>(`/admin/shop/categories/${id}`, { method: "PATCH", ...json(input) });
export const reorderAdminShopCategories = (orderedIds: string[]) =>
  apiRequest<ShopCategory[]>("/admin/shop/categories/reorder", { method: "POST", ...json({ orderedIds }) });
export const deleteAdminShopCategory = (id: string) =>
  apiRequest<{ deleted: boolean }>(`/admin/shop/categories/${id}`, { method: "DELETE" });

// products
export async function listAdminShopProducts(q: AdminProductListQuery = {}): Promise<{ items: ShopAdminProduct[]; meta: PageMeta }> {
  const query = toQuery({
    ...q,
    active: q.active === undefined ? undefined : String(q.active),
    lowStock: q.lowStock ? "true" : undefined,
  });
  const { data, meta } = await requestPaged<ShopAdminProduct[]>(`/admin/shop/products${query}`);
  return { items: data, meta };
}
export const getAdminShopProduct = (id: string) => apiRequest<ShopAdminProduct>(`/admin/shop/products/${id}`);
export const createAdminShopProduct = (input: AdminProductInput) =>
  apiRequest<ShopAdminProduct>("/admin/shop/products", { method: "POST", ...json(input) });
export const updateAdminShopProduct = (id: string, input: Partial<AdminProductInput>) =>
  apiRequest<ShopAdminProduct>(`/admin/shop/products/${id}`, { method: "PATCH", ...json(input) });
export const deleteAdminShopProduct = (id: string) =>
  apiRequest<{ deleted: boolean }>(`/admin/shop/products/${id}`, { method: "DELETE" });
export const adjustAdminShopStock = (id: string, input: { stockQuantity: number } | { delta: number }) =>
  apiRequest<ShopAdminProduct>(`/admin/shop/products/${id}/stock`, { method: "POST", ...json(input) });
export const setAdminShopProductImages = (id: string, images: Array<{ mediaId: string; altText?: string | null; isPrimary?: boolean }>) =>
  apiRequest<ShopAdminProduct>(`/admin/shop/products/${id}/images`, { method: "PUT", ...json({ images }) });
export const setAdminShopProductVideos = (id: string, videos: AdminVideoInput[]) =>
  apiRequest<ShopAdminProduct>(`/admin/shop/products/${id}/videos`, { method: "PUT", ...json({ videos }) });

// orders
export interface AdminShopOrderQuery {
  search?: string;
  status?: string;
  paymentStatus?: string;
  page?: number;
  pageSize?: number;
}
export async function listAdminShopOrders(q: AdminShopOrderQuery = {}): Promise<{ items: ShopAdminOrder[]; meta: PageMeta }> {
  const { data, meta } = await requestPaged<ShopAdminOrder[]>(`/admin/shop/orders${toQuery({ ...q })}`);
  return { items: data, meta };
}
export const getAdminShopOrder = (id: string) => apiRequest<ShopAdminOrder>(`/admin/shop/orders/${id}`);
export const updateAdminShopOrderStatus = (
  id: string,
  input: { status: "processing" | "shipped" | "delivered" | "cancelled" | "refunded"; trackingCarrier?: string | null; trackingNumber?: string | null; reason?: string | null }
) => apiRequest<ShopAdminOrder>(`/admin/shop/orders/${id}/status`, { method: "PATCH", ...json(input) });
export const updateAdminShopOrderTracking = (id: string, input: { trackingCarrier?: string | null; trackingNumber?: string | null }) =>
  apiRequest<ShopAdminOrder>(`/admin/shop/orders/${id}/tracking`, { method: "PATCH", ...json(input) });

// city-wise availability / price
export const getAdminShopProductCities = (id: string) => apiRequest<ShopAdminProductCity[]>(`/admin/shop/products/${id}/cities`);
export const setAdminShopProductCities = (id: string, cities: Array<{ cityId: string; available: boolean; priceOverride?: number | null }>) =>
  apiRequest<ShopAdminProductCity[]>(`/admin/shop/products/${id}/cities`, { method: "PUT", ...json({ cities }) });
export const getAdminShopCityPricing = () => apiRequest<ShopCityPricing[]>("/admin/shop/city-pricing");
export const setAdminShopCityPricing = (cities: Array<{ cityId: string; productPriceAdjustPercent: number }>) =>
  apiRequest<ShopCityPricing[]>("/admin/shop/city-pricing", { method: "PUT", ...json({ cities }) });
