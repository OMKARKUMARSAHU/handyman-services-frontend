import { Router } from "express";
import { citiesRouter } from "../modules/cities/cities.routes";
import { categoriesRouter } from "../modules/categories/categories.routes";
import { productsRouter } from "../modules/products/products.routes";
import { serviceTypesRouter } from "../modules/service-types/service-types.routes";
import { servicesRouter } from "../modules/services/services.routes";
import { approvalsRouter } from "../modules/approvals/approvals.routes";
import { providersRouter } from "../modules/providers/providers.routes";
import { customersRouter } from "../modules/customers/customers.routes";
import { cartRouter } from "../modules/cart/cart.routes";
import { ordersRouter } from "../modules/orders/orders.routes";
import { paymentsRouter } from "../modules/payments/payments.routes";
import { offersRouter } from "../modules/offers/offers.routes";
import { searchRouter } from "../modules/search/search.routes";
import { mediaRouter } from "../modules/media/media.routes";
import { mediaLibraryRouter } from "../modules/media-library/media-library.routes";
import { contentRouter } from "../modules/content/content.routes";
import { usersRouter } from "../modules/users/users.routes";
import { authRouter } from "../modules/auth/auth.routes";

/**
 * Assembles every module's router under one mount point (`env.API_BASE_PATH`,
 * applied once in app.ts). Each module owns its own path prefixes
 * (/customer/*, /provider/*, /admin/*, or bare public catalog paths) so
 * this file stays a pure aggregator with no route logic of its own.
 *
 * The `admins` module directory has no router of its own — no dedicated
 * `admins` table exists (Admin identity is Cognito-group-only per the
 * finalized 3-role design), so there is nothing admin-specific to route
 * here beyond the many `/admin/*` routes each other module already owns.
 */
export function buildRouter(): Router {
  const router = Router();

  router.use(authRouter());
  router.use(citiesRouter());
  router.use(categoriesRouter());
  router.use(productsRouter());
  router.use(serviceTypesRouter());
  router.use(servicesRouter());
  router.use(approvalsRouter());
  router.use(providersRouter());
  router.use(customersRouter());
  router.use(cartRouter());
  router.use(ordersRouter());
  router.use(paymentsRouter());
  router.use(offersRouter());
  router.use(searchRouter());
  router.use(mediaRouter());
  router.use(mediaLibraryRouter());
  router.use(contentRouter());
  router.use(usersRouter());

  return router;
}
