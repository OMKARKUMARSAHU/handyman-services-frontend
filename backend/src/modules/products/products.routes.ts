import { Router } from "express";
import { asyncHandler } from "../../shared/asyncHandler";
import { created, ok } from "../../shared/response";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/authorize";
import { validateBody, validateParams } from "../../middleware/validate";
import { createProductSchema, productIdParamsSchema, updateProductSchema } from "./products.schema";
import { createProduct, updateProduct } from "./products.service";

/** Public product-browsing routes are mounted under /categories/:categorySlug/products (categories.routes.ts). This router only carries the Admin CRUD surface. */
export function productsRouter(): Router {
  const router = Router();

  router.post(
    "/admin/products",
    authenticate(),
    requireRole("admin"),
    validateBody(createProductSchema),
    asyncHandler(async (req, res) => {
      created(res, await createProduct(req.body));
    })
  );

  router.patch(
    "/admin/products/:id",
    authenticate(),
    requireRole("admin"),
    validateParams(productIdParamsSchema),
    validateBody(updateProductSchema),
    asyncHandler(async (req, res) => {
      ok(res, await updateProduct(req.params.id!, req.body));
    })
  );

  return router;
}
