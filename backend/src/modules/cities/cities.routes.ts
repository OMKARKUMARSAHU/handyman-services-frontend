import { Router } from "express";
import { asyncHandler } from "../../shared/asyncHandler";
import { created, ok } from "../../shared/response";
import { NotFoundError } from "../../shared/errors";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/authorize";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate";
import {
  createCitySchema,
  cityIdParamsSchema,
  citySlugParamsSchema,
  listCitiesQuerySchema,
  updateCitySchema,
} from "./cities.schema";
import { createCity, getCityBySlug, listCities, updateCity } from "./cities.service";

/**
 * PUBLIC: GET /cities, GET /cities/:slug — PHASE_2_BACKEND_API_CONTRACT.md.
 * ADMIN: POST/PATCH — PHASE_2_AUTHORIZATION_MATRIX.md §5 (Admin: All).
 */
export function citiesRouter(): Router {
  const router = Router();

  router.get(
    "/cities",
    validateQuery(listCitiesQuerySchema),
    asyncHandler(async (req, res) => {
      const popularOnly = (req.query as { popular?: boolean }).popular === true;
      const cities = await listCities({ popularOnly });
      ok(res, cities);
    })
  );

  router.get(
    "/cities/:slug",
    validateParams(citySlugParamsSchema),
    asyncHandler(async (req, res) => {
      const city = await getCityBySlug(req.params.slug!);
      if (!city) throw new NotFoundError("City not found.");
      ok(res, city);
    })
  );

  // ADMIN CMS FOLLOW-UP: unrestricted listing (active or not) so a
  // disabled city stays visible/re-enable-able in Admin. See the
  // `includeInactive` doc comment on `listCities()`.
  router.get(
    "/admin/cities",
    authenticate(),
    requireRole("admin"),
    asyncHandler(async (_req, res) => {
      ok(res, await listCities({ includeInactive: true }));
    })
  );

  router.post(
    "/admin/cities",
    authenticate(),
    requireRole("admin"),
    validateBody(createCitySchema),
    asyncHandler(async (req, res) => {
      const city = await createCity(req.body);
      created(res, city);
    })
  );

  router.patch(
    "/admin/cities/:id",
    authenticate(),
    requireRole("admin"),
    validateParams(cityIdParamsSchema),
    validateBody(updateCitySchema),
    asyncHandler(async (req, res) => {
      const city = await updateCity(req.params.id!, req.body);
      ok(res, city);
    })
  );

  return router;
}
