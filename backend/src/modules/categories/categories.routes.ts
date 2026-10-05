import { Router } from "express";
import { asyncHandler } from "../../shared/asyncHandler";
import { created, ok } from "../../shared/response";
import { NotFoundError } from "../../shared/errors";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/authorize";
import { validateBody, validateParams } from "../../middleware/validate";
import {
  categoryIdParamsSchema,
  categorySlugParamsSchema,
  createCategorySchema,
  updateCategorySchema,
} from "./categories.schema";
import { createCategory, getCategoryBySlug, listCategories, updateCategory } from "./categories.service";
import { listProductsByCategorySlug, getProductBySlugs } from "../products/products.service";
import { productSlugParamsSchema } from "../products/products.schema";

export function categoriesRouter(): Router {
  const router = Router();

  router.get(
    "/categories",
    asyncHandler(async (_req, res) => {
      ok(res, await listCategories());
    })
  );

  router.get(
    "/categories/:slug",
    validateParams(categorySlugParamsSchema),
    asyncHandler(async (req, res) => {
      const category = await getCategoryBySlug(req.params.slug!);
      if (!category) throw new NotFoundError("Category not found.");
      ok(res, category);
    })
  );

  router.get(
    "/categories/:categorySlug/products",
    asyncHandler(async (req, res) => {
      const products = await listProductsByCategorySlug(req.params.categorySlug!);
      ok(res, products);
    })
  );

  router.get(
    "/categories/:categorySlug/products/:productSlug",
    validateParams(productSlugParamsSchema),
    asyncHandler(async (req, res) => {
      const product = await getProductBySlugs(req.params.categorySlug!, req.params.productSlug!);
      if (!product) throw new NotFoundError("Product not found.");
      ok(res, product);
    })
  );

  // ADMIN CMS FOLLOW-UP: unrestricted category + per-category product
  // listings (active or not), so Admin can find and re-enable something
  // it previously disabled -- the public routes above stay active-only.
  router.get(
    "/admin/categories",
    authenticate(),
    requireRole("admin"),
    asyncHandler(async (_req, res) => {
      ok(res, await listCategories({ includeInactive: true }));
    })
  );

  router.get(
    "/admin/categories/:categorySlug/products",
    authenticate(),
    requireRole("admin"),
    asyncHandler(async (req, res) => {
      const products = await listProductsByCategorySlug(req.params.categorySlug!, { includeInactive: true });
      ok(res, products);
    })
  );

  router.post(
    "/admin/categories",
    authenticate(),
    requireRole("admin"),
    validateBody(createCategorySchema),
    asyncHandler(async (req, res) => {
      created(res, await createCategory(req.body));
    })
  );

  router.patch(
    "/admin/categories/:id",
    authenticate(),
    requireRole("admin"),
    validateParams(categoryIdParamsSchema),
    validateBody(updateCategorySchema),
    asyncHandler(async (req, res) => {
      ok(res, await updateCategory(req.params.id!, req.body));
    })
  );

  return router;
}
