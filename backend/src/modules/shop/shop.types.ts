/**
 * E-commerce "Products" section — shared row/DTO types.
 * See migration 20260101000020 for the schema rationale. Everything exposed
 * on a PUBLIC route is built by the `toPublic*` mappers below; admin DTOs add
 * the operational fields (stock count, draft/active flags, SEO, demo flag).
 */

export type ShopProductStatus = "draft" | "published";
export type ShopStockStatus = "in_stock" | "low_stock" | "out_of_stock";

export const SHOP_ORDER_STATUSES = ["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"] as const;
export type ShopOrderStatus = (typeof SHOP_ORDER_STATUSES)[number];
export const SHOP_PAYMENT_STATUSES = ["unpaid", "pending", "paid", "failed", "refunded"] as const;
export type ShopPaymentStatus = (typeof SHOP_PAYMENT_STATUSES)[number];

/** Per-line cap so one cart line can never reserve unbounded stock. */
export const MAX_QTY_PER_LINE = 20;
export const MAX_CART_LINES = 30;
export const MAX_PRODUCT_IMAGES = 6;
export const MAX_PRODUCT_VIDEOS = 4;

export interface ShopCategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  active: number | boolean;
  seo_title: string | null;
  seo_description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ShopCategoryDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  active: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  /** Public count = published+active products; admin count = all products. */
  productCount: number;
}

export interface ShopProductRow {
  id: string;
  category_id: string;
  slug: string;
  sku: string;
  name: string;
  short_description: string | null;
  description: string | null;
  price: string | number;
  mrp: string | number | null;
  stock_quantity: number;
  low_stock_threshold: number;
  track_inventory: number | boolean;
  status: ShopProductStatus;
  active: number | boolean;
  featured: number | boolean;
  specifications: unknown;
  compatible_models: unknown;
  delivery_info: string | null;
  return_info: string | null;
  seo_title: string | null;
  seo_description: string | null;
  is_demo: number | boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ShopImageDto {
  id: string;
  mediaId: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ShopVideoDto {
  id: string;
  kind: "youtube" | "upload";
  title: string | null;
  sortOrder: number;
  mediaId: string | null;
  /** upload: the media URL. youtube: null. */
  url: string | null;
  youtubeId: string | null;
  /** privacy-enhanced embed URL (youtube-nocookie) for youtube kind. */
  embedUrl: string | null;
  watchUrl: string | null;
}

export interface ShopSpecification {
  label: string;
  value: string;
}

export interface ShopProductSummaryDto {
  id: string;
  slug: string;
  sku: string;
  name: string;
  shortDescription: string | null;
  price: number;
  mrp: number | null;
  discountPercent: number | null;
  stockStatus: ShopStockStatus;
  inStock: boolean;
  featured: boolean;
  isDemo: boolean;
  category: { id: string; slug: string; name: string };
  primaryImage: { url: string; altText: string | null } | null;
  /** False only when a city was supplied and an admin marked the product unavailable there. */
  availableInCity: boolean;
  createdAt: string;
}

export interface ShopProductDetailDto extends ShopProductSummaryDto {
  description: string | null;
  images: ShopImageDto[];
  videos: ShopVideoDto[];
  specifications: ShopSpecification[];
  compatibleModels: string[];
  /** Product-level text, falling back to the admin-configured store default. */
  deliveryInfo: string | null;
  returnInfo: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  /** Max quantity a customer may add right now (min of stock and per-line cap). */
  maxOrderQuantity: number;
  updatedAt: string;
}

export interface ShopAdminProductDto extends ShopProductDetailDto {
  status: ShopProductStatus;
  active: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  categoryId: string;
  lowStock: boolean;
}

export interface ShopSettingsDto {
  deliveryCharge: number;
  freeDeliveryThreshold: number | null;
  defaultDeliveryInfo: string | null;
  defaultReturnInfo: string | null;
  lowStockThresholdDefault: number;
}

export interface ShopCartLineInput {
  productId: string;
  quantity: number;
}

export interface ShopCartLineDto {
  productId: string;
  slug: string | null;
  name: string;
  sku: string | null;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  available: boolean;
  /** Human-readable reason when `available` is false or quantity was clamped. */
  issue: string | null;
  maxOrderQuantity: number;
}

export interface ShopCartPricingDto {
  lines: ShopCartLineDto[];
  subtotal: number;
  deliveryCharge: number;
  total: number;
  freeDeliveryThreshold: number | null;
  /** True when every line is purchasable at the requested quantity AND a valid city was supplied. */
  canCheckout: boolean;
  /** True when no city was supplied: prices shown are base prices and checkout is blocked until a city is chosen. */
  cityRequired: boolean;
  city: { slug: string; name: string } | null;
}

export interface ShopOrderItemDto {
  id: string;
  productId: string | null;
  productName: string;
  productSku: string;
  productSlug: string | null;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface ShopOrderDto {
  id: string;
  orderNumber: string;
  customerId: string;
  status: ShopOrderStatus;
  paymentStatus: ShopPaymentStatus;
  subtotal: number;
  deliveryCharge: number;
  total: number;
  shipping: {
    name: string;
    phone: string | null;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    pincode: string;
  };
  tracking: { carrier: string | null; number: string | null; shippedAt: string | null };
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  items: ShopOrderItemDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ShopAdminOrderDto extends ShopOrderDto {
  customer: { id: string; name: string; email: string | null; phone: string | null };
  payment: {
    provider: string;
    providerOrderId: string | null;
    providerPaymentId: string | null;
    status: string;
    signatureVerified: boolean;
    failureReason: string | null;
  } | null;
}
