import { Router } from "express";
import { asyncHandler } from "../../shared/asyncHandler";
import { NotFoundError } from "../../shared/errors";
import { created, ok, parsePagination, buildPageMeta } from "../../shared/response";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/authorize";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate";
import {
  adminListOffersQuerySchema,
  createOfferSchema,
  listOffersQuerySchema,
  offerIdParamsSchema,
  updateOfferSchema,
} from "./offers.schema";
import {
  createOffer,
  getOfferById,
  listOffersAdmin,
  listOffersPublic,
  updateOffer,
  type AdminOfferFilters,
  type PublicOfferFilters,
} from "./offers.service";

export function offersRouter(): Router {
  const router = Router();

  router.get(
    "/offers",
    validateQuery(listOffersQuerySchema),
    asyncHandler(async (req, res) => {
      const filters = req.query as unknown as PublicOfferFilters;
      ok(res, await listOffersPublic(filters));
    })
  );

  // Admin-only, unrestricted READ — the correction brief explicitly
  // requires Admin be able to CREATE/READ/UPDATE/ACTIVATE/DEACTIVATE
  // offers; the public, city-scoped GET /offers above cannot serve as an
  // admin management listing since it deliberately hides other cities'
  // CITY offers and (without a cityId) all CITY offers entirely.
  router.get(
    "/admin/offers",
    authenticate(),
    requireRole("admin"),
    validateQuery(adminListOffersQuerySchema),
    asyncHandler(async (req, res) => {
      const pagination = parsePagination(req.query as Record<string, unknown>);
      const filters = req.query as unknown as AdminOfferFilters;
      const { items, total } = await listOffersAdmin(filters, pagination);
      ok(res, items, buildPageMeta(pagination, total));
    })
  );

  router.get(
    "/admin/offers/:id",
    authenticate(),
    requireRole("admin"),
    validateParams(offerIdParamsSchema),
    asyncHandler(async (req, res) => {
      const offer = await getOfferById(req.params.id!);
      if (!offer) throw new NotFoundError("Offer not found.");
      ok(res, offer);
    })
  );

  router.post(
    "/admin/offers",
    authenticate(),
    requireRole("admin"),
    validateBody(createOfferSchema),
    asyncHandler(async (req, res) => {
      created(res, await createOffer(req.body));
    })
  );

  router.patch(
    "/admin/offers/:id",
    authenticate(),
    requireRole("admin"),
    validateParams(offerIdParamsSchema),
    validateBody(updateOfferSchema),
    asyncHandler(async (req, res) => {
      ok(res, await updateOffer(req.params.id!, req.body));
    })
  );

  return router;
}
