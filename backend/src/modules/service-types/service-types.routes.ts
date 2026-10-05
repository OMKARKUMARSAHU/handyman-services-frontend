import { Router } from "express";
import { asyncHandler } from "../../shared/asyncHandler";
import { created, ok } from "../../shared/response";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/authorize";
import { validateBody, validateParams } from "../../middleware/validate";
import { createServiceTypeSchema, serviceTypeIdParamsSchema, updateServiceTypeSchema } from "./service-types.schema";
import { createServiceType, listServiceTypes, updateServiceType } from "./service-types.service";

export function serviceTypesRouter(): Router {
  const router = Router();

  router.get(
    "/service-types",
    asyncHandler(async (_req, res) => {
      ok(res, await listServiceTypes());
    })
  );

  // ADMIN CMS FOLLOW-UP: unrestricted listing (active or not).
  router.get(
    "/admin/service-types",
    authenticate(),
    requireRole("admin"),
    asyncHandler(async (_req, res) => {
      ok(res, await listServiceTypes({ includeInactive: true }));
    })
  );

  router.post(
    "/admin/service-types",
    authenticate(),
    requireRole("admin"),
    validateBody(createServiceTypeSchema),
    asyncHandler(async (req, res) => {
      created(res, await createServiceType(req.body));
    })
  );

  router.patch(
    "/admin/service-types/:id",
    authenticate(),
    requireRole("admin"),
    validateParams(serviceTypeIdParamsSchema),
    validateBody(updateServiceTypeSchema),
    asyncHandler(async (req, res) => {
      ok(res, await updateServiceType(req.params.id!, req.body));
    })
  );

  return router;
}
