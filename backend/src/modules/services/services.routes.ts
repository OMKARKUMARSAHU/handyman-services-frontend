import { Router } from "express";
import { asyncHandler } from "../../shared/asyncHandler";
import { created, ok, parsePagination, buildPageMeta } from "../../shared/response";
import { NotFoundError } from "../../shared/errors";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/authorize";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate";
import {
  createServiceSchema,
  listServicesQuerySchema,
  serviceIdParamsSchema,
  serviceSlugParamsSchema,
  setCityAvailabilitySchema,
  updateServiceSchema,
} from "./services.schema";
import {
  createService,
  getServiceBySlugPublic,
  listServicesPublic,
  updateService,
  type PublicServiceFilters,
} from "./services.service";
import { setServiceCityAvailability } from "../availability/availability.service";

export function servicesRouter(): Router {
  const router = Router();

  router.get(
    "/services",
    validateQuery(listServicesQuerySchema),
    asyncHandler(async (req, res) => {
      const q = req.query as unknown as PublicServiceFilters & { page?: number; pageSize?: number };
      const pagination = parsePagination(req.query as Record<string, unknown>);
      const { items, total } = await listServicesPublic(q, pagination);
      ok(res, items, buildPageMeta(pagination, total));
    })
  );

  router.get(
    "/services/:slug",
    validateParams(serviceSlugParamsSchema),
    asyncHandler(async (req, res) => {
      const cityId = typeof req.query.cityId === "string" ? req.query.cityId : undefined;
      const service = await getServiceBySlugPublic(req.params.slug!, cityId);
      if (!service) throw new NotFoundError("Service not found.");
      ok(res, service);
    })
  );

  router.post(
    "/admin/services",
    authenticate(),
    requireRole("admin"),
    validateBody(createServiceSchema),
    asyncHandler(async (req, res) => {
      // Admin-created listings ALSO start pending_approval (Phase 3 brief §5/§6 — final, no bypass).
      const service = await createService(req.body, "admin", req.auth!.sub);
      created(res, service);
    })
  );

  router.patch(
    "/admin/services/:id",
    authenticate(),
    requireRole("admin"),
    validateParams(serviceIdParamsSchema),
    validateBody(updateServiceSchema),
    asyncHandler(async (req, res) => {
      const service = await updateService(req.params.id!, req.body, { role: "admin", sub: req.auth!.sub });
      ok(res, service);
    })
  );

  router.put(
    "/admin/services/:id/city-availability",
    authenticate(),
    requireRole("admin"),
    validateParams(serviceIdParamsSchema),
    validateBody(setCityAvailabilitySchema),
    asyncHandler(async (req, res) => {
      const result = await setServiceCityAvailability(req.params.id!, req.body.cities);
      ok(res, result);
    })
  );

  return router;
}
