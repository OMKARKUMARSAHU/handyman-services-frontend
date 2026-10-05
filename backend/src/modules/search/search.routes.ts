import { Router } from "express";
import { asyncHandler } from "../../shared/asyncHandler";
import { ok } from "../../shared/response";
import { validateQuery } from "../../middleware/validate";
import { searchQuerySchema } from "./search.schema";
import { searchCatalog } from "./search.service";

export function searchRouter(): Router {
  const router = Router();

  router.get(
    "/search",
    validateQuery(searchQuerySchema),
    asyncHandler(async (req, res) => {
      const { q, cityId } = req.query as { q: string; cityId?: string };
      ok(res, await searchCatalog(q, cityId));
    })
  );

  return router;
}
