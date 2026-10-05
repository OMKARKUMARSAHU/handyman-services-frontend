import { Router, type NextFunction, type Request, type Response } from "express";
import { asyncHandler } from "../../shared/asyncHandler";
import { created, ok } from "../../shared/response";
import { UnauthenticatedError, ForbiddenError } from "../../shared/errors";
import { authenticate } from "../../middleware/authenticate";
import { validateBody, validateParams } from "../../middleware/validate";
import { attachImageSchema, cmsUploadUrlSchema, imageIdParamsSchema, serviceIdParamsSchema, uploadUrlSchema } from "./media.schema";
import { attachServiceImage, createCmsUploadUrl, createUploadUrl, deleteServiceImage } from "./media.service";
import { requireRole } from "../../middleware/authorize";

/**
 * Media routes are shared by Admin and Provider (PHASE_2_BACKEND_API_CONTRACT.md
 * §MEDIA: "Admin, or Provider +ownership") — unlike the catalog routes, which
 * split into separate `/admin/...` and `/provider/...` prefixes, so the role
 * gate here is declarative ("must be one of these two roles") and the finer
 * ownership/approval-status rule is enforced inside media.service.ts, where
 * it can also see the target service.
 */
function requireAdminOrProvider() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new UnauthenticatedError());
      return;
    }
    if (req.auth.role !== "admin" && req.auth.role !== "provider") {
      next(new ForbiddenError("This action requires the admin or provider role."));
      return;
    }
    next();
  };
}

export function mediaRouter(): Router {
  const router = Router();

  router.post(
    "/media/upload-url",
    authenticate(),
    requireAdminOrProvider(),
    validateBody(uploadUrlSchema),
    asyncHandler(async (req, res) => {
      ok(res, await createUploadUrl(req.auth!, req.body));
    })
  );

  /**
   * Admin-only, non-service-scoped presign for CMS content (category/
   * product/city images, offer banners, homepage-section images, video
   * curation thumbnails/clips, branding) — see createCmsUploadUrl's doc
   * comment. Deliberately under /admin/ and admin-only, unlike the
   * service-image route above (shared with Provider).
   */
  router.post(
    "/admin/media/cms-upload-url",
    authenticate(),
    requireRole("admin"),
    validateBody(cmsUploadUrlSchema),
    asyncHandler(async (req, res) => {
      ok(res, await createCmsUploadUrl(req.body));
    })
  );

  router.post(
    "/media/:serviceId/images",
    authenticate(),
    requireAdminOrProvider(),
    validateParams(serviceIdParamsSchema),
    validateBody(attachImageSchema),
    asyncHandler(async (req, res) => {
      created(res, await attachServiceImage(req.auth!, req.params.serviceId!, req.body));
    })
  );

  router.delete(
    "/media/images/:id",
    authenticate(),
    requireAdminOrProvider(),
    validateParams(imageIdParamsSchema),
    asyncHandler(async (req, res) => {
      await deleteServiceImage(req.auth!, req.params.id!);
      ok(res, { success: true });
    })
  );

  return router;
}
