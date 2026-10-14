/**
 * E-commerce "Products" section — frontend types. These mirror the backend's
 * `/shop/*` DTOs (backend/src/modules/shop/shop.types.ts). Public responses
 * never carry stock counts or draft/active flags; the admin variants do.
 */

export type ShopStockStatus = "in_stock" | "low_stock" | "out_of_stock";

export interface ShopCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  active: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  productCount: number;
}

export interface ShopProductSummary {
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
  /** False only when a city was requested and an admin marked the product unavailable there. */
  availableInCity: boolean;
  createdAt: string;
}

export interface ShopImage {
  id: string;
  mediaId: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ShopVideo {
  id: string;
  kind: "youtube" | "upload";
  title: string | null;
  sortOrder: number;
  mediaId: string | null;
  url: string | null;
  youtubeId: string | null;
  embedUrl: string | null;
  watchUrl: string | null;
}

export interface ShopSpecification {
  label: string;
  value: string;
}

export interface ShopProductDetail extends ShopProductSummary {
  description: string | null;
  images: ShopImage[];
  videos: ShopVideo[];
  specifications: ShopSpecification[];
  compatibleModels: string[];
  deliveryInfo: string | null;
  returnInfo: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  maxOrderQuantity: number;
  updatedAt: string;
}

export interface ShopAdminProduct extends ShopProductDetail {
  status: "draft" | "published";
  active: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  categoryId: string;
  lowStock: boolean;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ShopSettings {
  deliveryCharge: number;
  freeDeliveryThreshold: number | null;
  defaultDeliveryInfo: string | null;
  defaultReturnInfo: string | null;
  lowStockThresholdDefault: number;
}

export interface ShopCartLine {
  productId: string;
  slug: string | null;
  name: string;
  sku: string | null;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  available: boolean;
  issue: string | null;
  maxOrderQuantity: number;
}

export interface ShopCartPricing {
  lines: ShopCartLine[];
  subtotal: number;
  deliveryCharge: number;
  total: number;
  freeDeliveryThreshold: number | null;
  canCheckout: boolean;
  /** True when no city was supplied — prices are base prices and checkout is blocked until a city is chosen. */
  cityRequired: boolean;
  city: { slug: string; name: string } | null;
}

export type ShopOrderStatus = "pending_payment" | "paid" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
export type ShopPaymentStatus = "unpaid" | "pending" | "paid" | "failed" | "refunded";

export const SHOP_ORDER_STATUS_LABEL: Record<ShopOrderStatus, string> = {
  pending_payment: "Pending payment",
  paid: "Paid",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export const SHOP_PAYMENT_STATUS_LABEL: Record<ShopPaymentStatus, string> = {
  unpaid: "Unpaid",
  pending: "Payment pending",
  paid: "Paid",
  failed: "Payment failed",
  refunded: "Refunded",
};

export interface ShopOrderItem {
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

export interface ShopOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  status: ShopOrderStatus;
  paymentStatus: ShopPaymentStatus;
  subtotal: number;
  deliveryCharge: number;
  total: number;
  shipping: { name: string; phone: string | null; line1: string; line2: string | null; city: string; state: string; pincode: string };
  tracking: { carrier: string | null; number: string | null; shippedAt: string | null };
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  items: ShopOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ShopAdminOrder extends ShopOrder {
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

export interface ShopRazorpayOrder {
  keyId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  orderId: string;
  orderNumber: string;
}

export interface ShopOverview {
  products: number;
  publishedProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  ordersAwaitingPayment: number;
  ordersToFulfil: number;
  paidAfterClosed: number;
}

export interface ShopAdminProductCity {
  cityId: string;
  slug: string;
  name: string;
  state: string;
  available: boolean;
  priceOverride: number | null;
  effectivePrice: number;
  cityAdjustPercent: number;
}

export interface ShopCityPricing {
  cityId: string;
  slug: string;
  name: string;
  state: string;
  productPriceAdjustPercent: number;
}
