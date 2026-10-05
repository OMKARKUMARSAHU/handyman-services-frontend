import { Router } from "express";
import { asyncHandler } from "../../shared/asyncHandler";
import { created, ok } from "../../shared/response";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/authorize";
import { validateBody, validateParams } from "../../middleware/validate";
import {
  createFaqSchema,
  createHomepageSectionSchema,
  createNavItemSchema,
  createTestimonialSchema,
  idParamsSchema,
  keyParamsSchema,
  updateFaqSchema,
  updateHomepageSectionSchema,
  updateNavItemSchema,
  updateTestimonialSchema,
  upsertBrandingSchema,
  upsertContactInfoSchema,
} from "./content.schema";
import { createTestimonial, deleteTestimonial, listApprovedTestimonials, listAllTestimonials, updateTestimonial } from "./testimonials.service";
import { createFaq, deleteFaq, listFaqs, updateFaq } from "./faqs.service";
import {
  createHomepageSection,
  deleteHomepageSection,
  listHomepageSections,
  updateHomepageSection,
} from "./homepageSections.service";
import { getContactInfo, upsertContactInfo } from "./contactInfo.service";
import { getBranding, upsertBranding } from "./branding.service";
import { createNavItem, deleteNavItem, listNavItems, updateNavItem } from "./navItems.service";
import { listAvailablePlans } from "./plans.service";

/**
 * Admin content/branding (PHASE_3 brief's "Admin Panel" §6 — resolving
 * PHASE_2_BACKEND_API_CONTRACT.md's "only built if Admin content-management
 * scope is confirmed" conditional in favor of "yes, confirmed" for Phase 3).
 * Everything here is DB/API-backed — no hardcoded homepage/FAQ/contact text
 * in the backend, media via S3 URL references only (never binary uploads
 * through this module — see modules/media for the actual upload flow).
 */
export function contentRouter(): Router {
  const router = Router();

  // --- Testimonials ---
  router.get(
    "/testimonials",
    asyncHandler(async (_req, res) => ok(res, await listApprovedTestimonials()))
  );
  router.get(
    "/admin/testimonials",
    authenticate(),
    requireRole("admin"),
    asyncHandler(async (_req, res) => ok(res, await listAllTestimonials()))
  );
  router.post(
    "/admin/testimonials",
    authenticate(),
    requireRole("admin"),
    validateBody(createTestimonialSchema),
    asyncHandler(async (req, res) => created(res, await createTestimonial(req.body)))
  );
  router.patch(
    "/admin/testimonials/:id",
    authenticate(),
    requireRole("admin"),
    validateParams(idParamsSchema),
    validateBody(updateTestimonialSchema),
    asyncHandler(async (req, res) => ok(res, await updateTestimonial(req.params.id!, req.body)))
  );
  router.delete(
    "/admin/testimonials/:id",
    authenticate(),
    requireRole("admin"),
    validateParams(idParamsSchema),
    asyncHandler(async (req, res) => {
      await deleteTestimonial(req.params.id!);
      ok(res, { success: true });
    })
  );

  // --- FAQs ---
  router.get(
    "/faqs",
    asyncHandler(async (_req, res) => ok(res, await listFaqs()))
  );
  router.post(
    "/admin/faqs",
    authenticate(),
    requireRole("admin"),
    validateBody(createFaqSchema),
    asyncHandler(async (req, res) => created(res, await createFaq(req.body)))
  );
  router.patch(
    "/admin/faqs/:id",
    authenticate(),
    requireRole("admin"),
    validateParams(idParamsSchema),
    validateBody(updateFaqSchema),
    asyncHandler(async (req, res) => ok(res, await updateFaq(req.params.id!, req.body)))
  );
  router.delete(
    "/admin/faqs/:id",
    authenticate(),
    requireRole("admin"),
    validateParams(idParamsSchema),
    asyncHandler(async (req, res) => {
      await deleteFaq(req.params.id!);
      ok(res, { success: true });
    })
  );

  // --- Homepage sections ---
  router.get(
    "/homepage-sections",
    asyncHandler(async (_req, res) => ok(res, await listHomepageSections()))
  );
  router.post(
    "/admin/homepage-sections",
    authenticate(),
    requireRole("admin"),
    validateBody(createHomepageSectionSchema),
    asyncHandler(async (req, res) => created(res, await createHomepageSection(req.body)))
  );
  router.patch(
    "/admin/homepage-sections/:key",
    authenticate(),
    requireRole("admin"),
    validateParams(keyParamsSchema),
    validateBody(updateHomepageSectionSchema),
    asyncHandler(async (req, res) => ok(res, await updateHomepageSection(req.params.key!, req.body)))
  );
  router.delete(
    "/admin/homepage-sections/:key",
    authenticate(),
    requireRole("admin"),
    validateParams(keyParamsSchema),
    asyncHandler(async (req, res) => {
      await deleteHomepageSection(req.params.key!);
      ok(res, { success: true });
    })
  );

  // --- Contact info (singleton) ---
  router.get(
    "/contact-info",
    asyncHandler(async (_req, res) => ok(res, await getContactInfo()))
  );
  router.patch(
    "/admin/contact-info",
    authenticate(),
    requireRole("admin"),
    validateBody(upsertContactInfoSchema),
    asyncHandler(async (req, res) => ok(res, await upsertContactInfo(req.body)))
  );

  // --- Branding (singleton) ---
  router.get(
    "/branding",
    asyncHandler(async (_req, res) => ok(res, await getBranding()))
  );
  router.patch(
    "/admin/branding",
    authenticate(),
    requireRole("admin"),
    validateBody(upsertBrandingSchema),
    asyncHandler(async (req, res) => ok(res, await upsertBranding(req.body)))
  );

  // --- Nav items ---
  router.get(
    "/nav-items",
    asyncHandler(async (_req, res) => ok(res, await listNavItems()))
  );
  router.post(
    "/admin/nav-items",
    authenticate(),
    requireRole("admin"),
    validateBody(createNavItemSchema),
    asyncHandler(async (req, res) => created(res, await createNavItem(req.body)))
  );
  router.patch(
    "/admin/nav-items/:id",
    authenticate(),
    requireRole("admin"),
    validateParams(idParamsSchema),
    validateBody(updateNavItemSchema),
    asyncHandler(async (req, res) => ok(res, await updateNavItem(req.params.id!, req.body)))
  );
  router.delete(
    "/admin/nav-items/:id",
    authenticate(),
    requireRole("admin"),
    validateParams(idParamsSchema),
    asyncHandler(async (req, res) => {
      await deleteNavItem(req.params.id!);
      ok(res, { success: true });
    })
  );

  // --- Plans (legacy, read-only — see plans.service.ts) ---
  router.get(
    "/plans",
    asyncHandler(async (_req, res) => ok(res, await listAvailablePlans()))
  );

  return router;
}
