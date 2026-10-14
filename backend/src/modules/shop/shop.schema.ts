import { z } from "zod";
import { MAX_CART_LINES, MAX_PRODUCT_IMAGES, MAX_PRODUCT_VIDEOS, MAX_QTY_PER_LINE, SHOP_ORDER_STATUSES } from "./shop.types";

const slugSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens.");

/** Money: > 0 (or >= 0 where noted), at most 2 decimals, under 1 crore. */
const MAX_MONEY = 9_999_999.99;
const money = z
  .number()
  .finite()
  .max(MAX_MONEY)
  .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6, "Use at most 2 decimal places.");
const positiveMoney = money.refine((n) => n > 0, "Must be greater than zero.");
const nonNegativeMoney = money.refine((n) => n >= 0, "Must not be negative.");

export const idParamsSchema = z.object({ id: z.string().uuid() });
export const slugParamsSchema = z.object({ slug: z.string().min(1).max(160) });

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
export const createShopCategorySchema = z.object({
  name: z.string().trim().min(1).max(150),
  slug: slugSchema.max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
  active: z.boolean().optional(),
  seoTitle: z.string().max(255).nullable().optional(),
  seoDescription: z.string().max(500).nullable().optional(),
});
export const updateShopCategorySchema = createShopCategorySchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one field to update." });
export const reorderShopCategoriesSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1).max(200),
});

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
const specificationsSchema = z
  .array(z.object({ label: z.string().trim().min(1).max(120), value: z.string().trim().min(1).max(500) }))
  .max(40);
const compatibleModelsSchema = z.array(z.string().trim().min(1).max(120)).max(100);

const productFields = {
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
  slug: slugSchema.optional(),
  sku: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[A-Za-z0-9._-]+$/, "SKU may contain letters, numbers, dots, dashes and underscores only."),
  shortDescription: z.string().max(500).nullable().optional(),
  description: z.string().max(20000).nullable().optional(),
  price: positiveMoney,
  mrp: positiveMoney.nullable().optional(),
  stockQuantity: z.number().int().min(0).max(1_000_000),
  lowStockThreshold: z.number().int().min(0).max(100000).optional(),
  trackInventory: z.boolean().optional(),
  status: z.enum(["draft", "published"]).optional(),
  active: z.boolean().optional(),
  featured: z.boolean().optional(),
  specifications: specificationsSchema.optional(),
  compatibleModels: compatibleModelsSchema.optional(),
  deliveryInfo: z.string().max(2000).nullable().optional(),
  returnInfo: z.string().max(2000).nullable().optional(),
  seoTitle: z.string().max(255).nullable().optional(),
  seoDescription: z.string().max(500).nullable().optional(),
  isDemo: z.boolean().optional(),
};

export const createShopProductSchema = z.object(productFields).superRefine((v, ctx) => {
  if (v.mrp != null && v.mrp < v.price) {
    ctx.addIssue({ code: "custom", path: ["mrp"], message: "MRP cannot be lower than the selling price." });
  }
});

export const updateShopProductSchema = z
  .object(productFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one field to update." })
  .superRefine((v, ctx) => {
    if (v.mrp != null && v.price != null && v.mrp < v.price) {
      ctx.addIssue({ code: "custom", path: ["mrp"], message: "MRP cannot be lower than the selling price." });
    }
  });

export const adjustStockSchema = z.union([
  z.object({ stockQuantity: z.number().int().min(0).max(1_000_000) }),
  z.object({ delta: z.number().int().min(-1_000_000).max(1_000_000) }),
]);

export const adminListProductsQuerySchema = z.object({
  search: z.string().max(120).optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(["draft", "published"]).optional(),
  active: z.enum(["true", "false"]).optional(),
  lowStock: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export const publicListProductsQuerySchema = z.object({
  search: z.string().max(120).optional(),
  category: z.string().max(120).optional(),
  sort: z.enum(["newest", "oldest", "price_asc", "price_desc"]).optional(),
  featured: z.enum(["true", "false"]).optional(),
  inStock: z.enum(["true", "false"]).optional(),
  city: z.string().max(120).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});
export const publicProductDetailQuerySchema = z.object({ city: z.string().max(120).optional() });

// ---------------------------------------------------------------------------
// Product media (images via Media Library, videos: YouTube URL or uploaded media)
// ---------------------------------------------------------------------------
export const setProductImagesSchema = z.object({
  images: z
    .array(
      z.object({
        mediaId: z.string().uuid(),
        altText: z.string().max(255).nullable().optional(),
        isPrimary: z.boolean().optional(),
      })
    )
    .max(MAX_PRODUCT_IMAGES),
});

export const setProductVideosSchema = z.object({
  videos: z
    .array(
      z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("youtube"), url: z.string().trim().min(1).max(500), title: z.string().max(255).nullable().optional() }),
        z.object({ kind: z.literal("upload"), mediaId: z.string().uuid(), title: z.string().max(255).nullable().optional() }),
      ])
    )
    .max(MAX_PRODUCT_VIDEOS),
});

// ---------------------------------------------------------------------------
// City-wise availability / pricing
// ---------------------------------------------------------------------------
export const setProductCitiesSchema = z.object({
  cities: z
    .array(
      z.object({
        cityId: z.string().uuid(),
        available: z.boolean(),
        priceOverride: positiveMoney.nullable().optional(),
      })
    )
    .max(500),
});

export const setCityPricingSchema = z.object({
  cities: z
    .array(
      z.object({
        cityId: z.string().uuid(),
        // Signed percentage; bounded so a typo cannot make products free or absurdly dear.
        productPriceAdjustPercent: z.number().finite().min(-90).max(500),
      })
    )
    .max(500),
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export const updateShopSettingsSchema = z
  .object({
    deliveryCharge: nonNegativeMoney.optional(),
    freeDeliveryThreshold: nonNegativeMoney.nullable().optional(),
    defaultDeliveryInfo: z.string().max(2000).nullable().optional(),
    defaultReturnInfo: z.string().max(2000).nullable().optional(),
    lowStockThresholdDefault: z.number().int().min(0).max(100000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one field to update." });

// ---------------------------------------------------------------------------
// Cart / orders / payments
// ---------------------------------------------------------------------------
export const cartLinesSchema = z
  .array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(MAX_QTY_PER_LINE) }))
  .min(1)
  .max(MAX_CART_LINES);

export const priceCartSchema = z.object({ items: cartLinesSchema, city: z.string().max(120).optional() });

export const createShopOrderSchema = z.object({
  items: cartLinesSchema,
  addressId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(100),
  /** City slug the order is priced and fulfilled for. Required: prices and availability are city-wise. */
  city: z.string().trim().min(1).max(120),
});

export const listOwnShopOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export const adminListShopOrdersQuerySchema = z.object({
  search: z.string().max(120).optional(),
  status: z.enum(SHOP_ORDER_STATUSES).optional(),
  paymentStatus: z.enum(["unpaid", "pending", "paid", "failed", "refunded"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export const updateShopOrderStatusSchema = z.object({
  status: z.enum(["processing", "shipped", "delivered", "cancelled", "refunded"]),
  trackingCarrier: z.string().max(120).nullable().optional(),
  trackingNumber: z.string().max(120).nullable().optional(),
  reason: z.string().max(500).nullable().optional(),
});

export const updateShopOrderTrackingSchema = z.object({
  trackingCarrier: z.string().max(120).nullable().optional(),
  trackingNumber: z.string().max(120).nullable().optional(),
});

export const shopRazorpayVerifySchema = z.object({
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_signature: z.string().min(1).max(200),
});

export const shopRazorpayFailedSchema = z.object({
  razorpayOrderId: z.string().min(1).max(100),
});
