import { Router } from "express";
import { asyncHandler } from "../../shared/asyncHandler";
import { ok, parsePagination } from "../../shared/response";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/authorize";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate";
import { listingQueueQuerySchema, rejectListingSchema, serviceIdParamsSchema } from "../services/services.schema";
import { approveListing, listApprovalQueue, rejectListing } from "../services/services.service";

/**
 * ONE shared Admin approval queue for BOTH Provider-created and
 * Admin-created listings — Phase 3 brief §5, explicitly final. No second
 * approver, no Super Admin, no separate pipeline per creator role.
 */
export function approvalsRouter(): Router {
  const router = Router();

  router.get(
    "/admin/listings/pending",
    authenticate(),
    requireRole("admin"),
    validateQuery(listingQueueQuerySchema),
    asyncHandler(async (req, res) => {
      const q = req.query as { status?: "pending_approval" | "approved" | "rejected"; createdByRole?: "admin" | "provider" };
      const pagination = parsePagination(req.query as Record<string, unknown>);
      // Default view is the live queue (pending only) unless the caller explicitly asks to see history.
      const status = q.status ?? "pending_approval";
      const { items, meta } = await listApprovalQueue({ status, createdByRole: q.createdByRole }, pagination);
      ok(res, items, meta);
    })
  );

  router.post(
    "/admin/listings/:id/approve",
    authenticate(),
    requireRole("admin"),
    validateParams(serviceIdParamsSchema),
    asyncHandler(async (req, res) => {
      const service = await approveListing(req.params.id!, req.auth!.sub);
      ok(res, service);
    })
  );

  router.post(
    "/admin/listings/:id/reject",
    authenticate(),
    requireRole("admin"),
    validateParams(serviceIdParamsSchema),
    validateBody(rejectListingSchema),
    asyncHandler(async (req, res) => {
      const service = await rejectListing(req.params.id!, req.auth!.sub, req.body.reason);
      ok(res, service);
    })
  );

  return router;
}
