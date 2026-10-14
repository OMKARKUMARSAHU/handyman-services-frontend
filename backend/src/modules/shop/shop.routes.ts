import { Router } from "express";
import { asyncHandler } from "../../shared/asyncHandler";
import { created, ok } from "../../shared/response";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/authorize";
import { strictRateLimiter } from "../../middleware/rateLimit";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate";
import { getDb } from "../../database/db";
import { findOrCreateCustomerBySub } from "../customers/customers.service";
import {
  adjustStockSchema,
  adminListProductsQuerySchema,
  adminListShopOrdersQuerySchema,
  createShopCategorySchema,
  createShopOrderSchema,
  createShopProductSchema,
  idParamsSchema,
  listOwnShopOrdersQuerySchema,
  priceCartSchema,
  publicListProductsQuerySchema,
  publicProductDetailQuerySchema,
  setCityPricingSchema,
  setProductCitiesSchema,
  reorderShopCategoriesSchema,
  setProductImagesSchema,
  setProductVideosSchema,
  shopRazorpayFailedSchema,
  shopRazorpayVerifySchema,
  slugParamsSchema,
  updateShopCategorySchema,
  updateShopOrderStatusSchema,
  updateShopOrderTrackingSchema,
  updateShopProductSchema,
  updateShopSettingsSchema,
} from "./shop.schema";
import {
  createShopCategory,
  deleteShopCategory,
  listAdminShopCategories,
  listPublicShopCategories,
  reorderShopCategories,
  updateShopCategory,
} from "./shopCategories.service";
import {
  adjustShopProductStock,
  createShopProduct,
  deleteShopProduct,
  getAdminShopProduct,
  getPublicShopProductBySlug,
  listAdminShopProducts,
  listPublicShopProducts,
  listPublishedShopProductsForSitemap,
  setShopProductImages,
  setShopProductVideos,
  updateShopProduct,
} from "./shopProducts.service";
import {
  cancelOwnShopOrder,
  createShopOrder,
  getAdminShopOrder,
  getOwnShopOrder,
  listAdminShopOrders,
  listOwnShopOrders,
  priceShopCart,
  updateShopOrderStatus,
  updateShopOrderTracking,
} from "./shopOrders.service";
import { createShopRazorpayOrder, handleShopRazorpayWebhook, markShopPaymentFailed, verifyShopRazorpayPayment } from "./shopPayments.service";
import { getShopSettings, updateShopSettings } from "./shopSettings.service";
import { seedShopDemoData } from "./shopDemo.service";
import { listCityPricing, listProductCities, setCityPricing, setProductCities } from "./shopCity.service";

/**
 * E-commerce "Products" routes. Namespaced `/shop/*` (public), `/customer/shop/*`
 * (customer-authenticated, ownership enforced in the service layer by comparing
 * the order's customer to the caller) and `/admin/shop/*` (admin only). Mirrors
 * the pipeline used everywhere else: authenticate → requireRole → validate →
 * asyncHandler. Public routes can only ever see published + active products in
 * active categories.
 */
export function shopRouter(): Router {
  const router = Router();
  const orderLimiter = strictRateLimiter(30);
  const webhookLimiter = strictRateLimiter(300);

  // ---------------------------------------------------------------- public
  router.get("/shop/categories", asyncHandler(async (_req, res) => ok(res, await listPublicShopCategories())));

  router.get(
    "/shop/products",
    validateQuery(publicListProductsQuerySchema),
    asyncHandler(async (req, res) => {
      const q = req.query as unknown as {
        search?: string;
        category?: string;
        sort?: "newest" | "oldest" | "price_asc" | "price_desc";
        featured?: "true" | "false";
        inStock?: "true" | "false";
        city?: string;
        page?: number;
        pageSize?: number;
      };
      const result = await listPublicShopProducts({
        search: q.search,
        category: q.category,
        sort: q.sort,
        featured: q.featured === "true",
        inStock: q.inStock === "true",
        city: q.city,
        page: q.page,
        pageSize: q.pageSize,
      });
      ok(res, result.items, result.meta);
    })
  );

  router.get(
    "/shop/products/:slug",
    validateParams(slugParamsSchema),
    validateQuery(publicProductDetailQuerySchema),
    asyncHandler(async (req, res) => ok(res, await getPublicShopProductBySlug(req.params.slug!, (req.query as { city?: string }).city)))
  );

  router.get(
    "/shop/settings/public",
    asyncHandler(async (_req, res) => {
      const s = await getShopSettings();
      ok(res, { deliveryCharge: s.deliveryCharge, freeDeliveryThreshold: s.freeDeliveryThreshold });
    })
  );

  router.get(
    "/shop/sitemap-data",
    asyncHandler(async (_req, res) => {
      const [categories, products] = await Promise.all([listPublicShopCategories(), listPublishedShopProductsForSitemap()]);
      ok(res, { categories: categories.map((c) => ({ slug: c.slug })), products });
    })
  );

  router.post(
    "/shop/cart/price",
    strictRateLimiter(120),
    validateBody(priceCartSchema),
    asyncHandler(async (req, res) => ok(res, await priceShopCart(req.body.items, req.body.city)))
  );

  // --------------------------------------------------------------- webhook
  router.post(
    "/shop/webhooks/razorpay",
    webhookLimiter,
    asyncHandler(async (req, res) => {
      const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
      const signature = req.header("x-razorpay-signature") ?? undefined;
      const eventId = req.header("x-razorpay-event-id") ?? undefined;
      const result = await handleShopRazorpayWebhook(rawBody, signature, eventId);
      // 200 for processed / duplicate / ignored so the gateway stops retrying.
      ok(res, result);
    })
  );

  // -------------------------------------------------------------- customer
  router.post(
    "/customer/shop/orders",
    orderLimiter,
    authenticate(),
    requireRole("customer"),
    validateBody(createShopOrderSchema),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateCustomerBySub(req.auth!.sub, req.auth!.claims);
      created(res, await createShopOrder(profile.id, req.body));
    })
  );

  router.get(
    "/customer/shop/orders",
    authenticate(),
    requireRole("customer"),
    validateQuery(listOwnShopOrdersQuerySchema),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateCustomerBySub(req.auth!.sub, req.auth!.claims);
      const q = req.query as unknown as { page?: number; pageSize?: number };
      const result = await listOwnShopOrders(profile.id, q);
      ok(res, result.items, result.meta);
    })
  );

  router.get(
    "/customer/shop/orders/:id",
    authenticate(),
    requireRole("customer"),
    validateParams(idParamsSchema),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateCustomerBySub(req.auth!.sub, req.auth!.claims);
      ok(res, await getOwnShopOrder(profile.id, req.params.id!));
    })
  );

  router.post(
    "/customer/shop/orders/:id/cancel",
    orderLimiter,
    authenticate(),
    requireRole("customer"),
    validateParams(idParamsSchema),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateCustomerBySub(req.auth!.sub, req.auth!.claims);
      ok(res, await cancelOwnShopOrder(profile.id, req.params.id!));
    })
  );

  router.post(
    "/customer/shop/orders/:id/payment/razorpay-order",
    orderLimiter,
    authenticate(),
    requireRole("customer"),
    validateParams(idParamsSchema),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateCustomerBySub(req.auth!.sub, req.auth!.claims);
      created(res, await createShopRazorpayOrder(profile.id, req.params.id!));
    })
  );

  router.post(
    "/customer/shop/orders/:id/payment/razorpay-verify",
    orderLimiter,
    authenticate(),
    requireRole("customer"),
    validateParams(idParamsSchema),
    validateBody(shopRazorpayVerifySchema),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateCustomerBySub(req.auth!.sub, req.auth!.claims);
      ok(res, await verifyShopRazorpayPayment(profile.id, req.params.id!, req.body));
    })
  );

  router.post(
    "/customer/shop/orders/:id/payment/razorpay-failed",
    orderLimiter,
    authenticate(),
    requireRole("customer"),
    validateParams(idParamsSchema),
    validateBody(shopRazorpayFailedSchema),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateCustomerBySub(req.auth!.sub, req.auth!.claims);
      await markShopPaymentFailed(profile.id, req.params.id!, req.body.razorpayOrderId);
      ok(res, { acknowledged: true });
    })
  );

  // ----------------------------------------------------------------- admin
  const admin = [authenticate(), requireRole("admin")] as const;

  router.get(
    "/admin/shop/overview",
    ...admin,
    asyncHandler(async (_req, res) => {
      const db = getDb();
      const count = async (q: ReturnType<typeof db>): Promise<number> => Number(((await q.count({ n: "id" }).first()) as { n: number | string } | undefined)?.n ?? 0);
      ok(res, {
        products: await count(db("shop_products")),
        publishedProducts: await count(db("shop_products").where({ status: "published", active: true })),
        lowStockProducts: await count(db("shop_products").where({ track_inventory: true }).whereRaw("stock_quantity <= low_stock_threshold")),
        outOfStockProducts: await count(db("shop_products").where({ track_inventory: true }).where("stock_quantity", "<=", 0)),
        ordersAwaitingPayment: await count(db("shop_orders").where({ status: "pending_payment" })),
        ordersToFulfil: await count(db("shop_orders").whereIn("status", ["paid", "processing"])),
        paidAfterClosed: await count(db("shop_orders").where({ payment_status: "paid", status: "cancelled" })),
      });
    })
  );

  router.get("/admin/shop/settings", ...admin, asyncHandler(async (_req, res) => ok(res, await getShopSettings())));
  router.put(
    "/admin/shop/settings",
    ...admin,
    validateBody(updateShopSettingsSchema),
    asyncHandler(async (req, res) => ok(res, await updateShopSettings(req.body)))
  );

  router.post("/admin/shop/seed-demo", ...admin, asyncHandler(async (_req, res) => ok(res, await seedShopDemoData())));

  // categories
  router.get("/admin/shop/categories", ...admin, asyncHandler(async (_req, res) => ok(res, await listAdminShopCategories())));
  router.post(
    "/admin/shop/categories",
    ...admin,
    validateBody(createShopCategorySchema),
    asyncHandler(async (req, res) => created(res, await createShopCategory(req.body)))
  );
  router.post(
    "/admin/shop/categories/reorder",
    ...admin,
    validateBody(reorderShopCategoriesSchema),
    asyncHandler(async (req, res) => ok(res, await reorderShopCategories(req.body.orderedIds)))
  );
  router.patch(
    "/admin/shop/categories/:id",
    ...admin,
    validateParams(idParamsSchema),
    validateBody(updateShopCategorySchema),
    asyncHandler(async (req, res) => ok(res, await updateShopCategory(req.params.id!, req.body)))
  );
  router.delete(
    "/admin/shop/categories/:id",
    ...admin,
    validateParams(idParamsSchema),
    asyncHandler(async (req, res) => {
      await deleteShopCategory(req.params.id!);
      ok(res, { deleted: true });
    })
  );

  // products
  router.get(
    "/admin/shop/products",
    ...admin,
    validateQuery(adminListProductsQuerySchema),
    asyncHandler(async (req, res) => {
      const q = req.query as unknown as {
        search?: string;
        categoryId?: string;
        status?: "draft" | "published";
        active?: "true" | "false";
        lowStock?: "true" | "false";
        page?: number;
        pageSize?: number;
      };
      const result = await listAdminShopProducts({
        search: q.search,
        categoryId: q.categoryId,
        status: q.status,
        active: q.active === undefined ? undefined : q.active === "true",
        lowStock: q.lowStock === "true",
        page: q.page,
        pageSize: q.pageSize,
      });
      ok(res, result.items, result.meta);
    })
  );
  router.post(
    "/admin/shop/products",
    ...admin,
    validateBody(createShopProductSchema),
    asyncHandler(async (req, res) => created(res, await createShopProduct(req.body)))
  );
  router.get(
    "/admin/shop/products/:id",
    ...admin,
    validateParams(idParamsSchema),
    asyncHandler(async (req, res) => ok(res, await getAdminShopProduct(req.params.id!)))
  );
  router.patch(
    "/admin/shop/products/:id",
    ...admin,
    validateParams(idParamsSchema),
    validateBody(updateShopProductSchema),
    asyncHandler(async (req, res) => ok(res, await updateShopProduct(req.params.id!, req.body)))
  );
  router.delete(
    "/admin/shop/products/:id",
    ...admin,
    validateParams(idParamsSchema),
    asyncHandler(async (req, res) => {
      await deleteShopProduct(req.params.id!);
      ok(res, { deleted: true });
    })
  );
  router.post(
    "/admin/shop/products/:id/stock",
    ...admin,
    validateParams(idParamsSchema),
    validateBody(adjustStockSchema),
    asyncHandler(async (req, res) => ok(res, await adjustShopProductStock(req.params.id!, req.body)))
  );
  router.put(
    "/admin/shop/products/:id/images",
    ...admin,
    validateParams(idParamsSchema),
    validateBody(setProductImagesSchema),
    asyncHandler(async (req, res) => ok(res, await setShopProductImages(req.params.id!, req.body.images)))
  );
  router.put(
    "/admin/shop/products/:id/videos",
    ...admin,
    validateParams(idParamsSchema),
    validateBody(setProductVideosSchema),
    asyncHandler(async (req, res) => ok(res, await setShopProductVideos(req.params.id!, req.body.videos)))
  );

  // city-wise availability / price per product, and per-city price adjustment
  router.get(
    "/admin/shop/products/:id/cities",
    ...admin,
    validateParams(idParamsSchema),
    asyncHandler(async (req, res) => ok(res, await listProductCities(req.params.id!)))
  );
  router.put(
    "/admin/shop/products/:id/cities",
    ...admin,
    validateParams(idParamsSchema),
    validateBody(setProductCitiesSchema),
    asyncHandler(async (req, res) => ok(res, await setProductCities(req.params.id!, req.body.cities)))
  );
  router.get("/admin/shop/city-pricing", ...admin, asyncHandler(async (_req, res) => ok(res, await listCityPricing())));
  router.put(
    "/admin/shop/city-pricing",
    ...admin,
    validateBody(setCityPricingSchema),
    asyncHandler(async (req, res) => ok(res, await setCityPricing(req.body.cities)))
  );

  // orders
  router.get(
    "/admin/shop/orders",
    ...admin,
    validateQuery(adminListShopOrdersQuerySchema),
    asyncHandler(async (req, res) => {
      const result = await listAdminShopOrders(req.query as never);
      ok(res, result.items, result.meta);
    })
  );
  router.get(
    "/admin/shop/orders/:id",
    ...admin,
    validateParams(idParamsSchema),
    asyncHandler(async (req, res) => ok(res, await getAdminShopOrder(req.params.id!)))
  );
  router.patch(
    "/admin/shop/orders/:id/status",
    ...admin,
    validateParams(idParamsSchema),
    validateBody(updateShopOrderStatusSchema),
    asyncHandler(async (req, res) => ok(res, await updateShopOrderStatus(req.params.id!, req.body)))
  );
  router.patch(
    "/admin/shop/orders/:id/tracking",
    ...admin,
    validateParams(idParamsSchema),
    validateBody(updateShopOrderTrackingSchema),
    asyncHandler(async (req, res) => ok(res, await updateShopOrderTracking(req.params.id!, req.body)))
  );

  return router;
}
