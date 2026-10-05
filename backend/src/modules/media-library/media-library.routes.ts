import { Router } from "express";
import { asyncHandler } from "../../shared/asyncHandler";
import { created, ok } from "../../shared/response";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/authorize";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate";
import { createMediaSchema, libraryUploadUrlSchema, listMediaQuerySchema, mediaIdParamsSchema, updateMediaSchema } from "./media-library.schema";
import { createLibraryUploadUrl, createMedia, deleteMedia, getMediaById, listMedia, updateMedia } from "./media-library.service";
import type { MediaType } from "./media-library.types";

/**
 * Central Media Library — Admin-only (the spec's explicit "Media
 * management must be Admin-only"; Provider never gets a route here,
 * unlike the shared `/media/...` per-service routes in
 * `../media/media.routes.ts`). Mounted under `/admin/media-library` — a
 * distinct prefix from the existing `/admin/media/cms-upload-url` and
 * `/media/...` routes in the sibling `media` module, so none of those
 * existing, already-working endpoints are touched by this feature.
 */
export function mediaLibraryRouter(): Router {
  const router = Router();

  router.post(
    "/admin/media-library/upload-url",
    authenticate(),
    requireRole("admin"),
    validateBody(libraryUploadUrlSchema),
    asyncHandler(async (req, res) => {
      ok(res, await createLibraryUploadUrl(req.body));
    })
  );

  router.post(
    "/admin/media-library",
    authenticate(),
    requireRole("admin"),
    validateBody(createMediaSchema),
    asyncHandler(async (req, res) => {
      created(res, await createMedia(req.body));
    })
  );

  router.get(
    "/admin/media-library",
    authenticate(),
    requireRole("admin"),
    validateQuery(listMediaQuerySchema),
    asyncHandler(async (req, res) => {
      const query = req.query as { type?: MediaType; search?: string; activeOnly?: boolean; page?: number; pageSize?: number };
      ok(res, await listMedia(query));
    })
  );

  router.get(
    "/admin/media-library/:id",
    authenticate(),
    requireRole("admin"),
    validateParams(mediaIdParamsSchema),
    asyncHandler(async (req, res) => {
      ok(res, await getMediaById(req.params.id!));
    })
  );

  router.patch(
    "/admin/media-library/:id",
    authenticate(),
    requireRole("admin"),
    validateParams(mediaIdParamsSchema),
    validateBody(updateMediaSchema),
    asyncHandler(async (req, res) => {
      ok(res, await updateMedia(req.params.id!, req.body));
    })
  );

  router.delete(
    "/admin/media-library/:id",
    authenticate(),
    requireRole("admin"),
    validateParams(mediaIdParamsSchema),
    asyncHandler(async (req, res) => {
      await deleteMedia(req.params.id!);
      ok(res, { success: true });
    })
  );

  return router;
}
