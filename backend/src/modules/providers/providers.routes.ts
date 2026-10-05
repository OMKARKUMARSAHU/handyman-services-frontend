import { Router } from "express";
import { asyncHandler } from "../../shared/asyncHandler";
import { created, ok, parsePagination, buildPageMeta } from "../../shared/response";
import { NotFoundError } from "../../shared/errors";
import { authenticate } from "../../middleware/authenticate";
import { requireOwnership, requireRole } from "../../middleware/authorize";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate";
import {
  listProvidersQuerySchema,
  providerIdParamsSchema,
  rejectProviderSchema,
  setAccountStatusSchema,
  updateOwnProviderSchema,
} from "./providers.schema";
import {
  approveProvider,
  assertProviderApproved,
  findOrCreateServiceProviderBySub,
  listServiceProviders,
  rejectProvider,
  setProviderAccountStatus,
  updateOwnProviderProfile,
} from "./providers.service";
import { createServiceSchema, ownListingsQuerySchema, serviceIdParamsSchema, updateServiceSchema } from "../services/services.schema";
import {
  createService,
  getManagedServiceById,
  getServiceOwnerSub,
  listOwnListings,
  updateService,
} from "../services/services.service";

export function providersRouter(): Router {
  const router = Router();

  // `/provider/me` deliberately does NOT call assertProviderApproved() — a
  // pending/rejected provider must still be able to see their own status
  // (FINAL AUTHENTICATION ARCHITECTURE §4/§10) via this exact endpoint.
  router.get(
    "/provider/me",
    authenticate(),
    requireRole("provider"),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateServiceProviderBySub(req.auth!.sub, req.auth!.claims);
      ok(res, profile);
    })
  );

  router.patch(
    "/provider/me",
    authenticate(),
    requireRole("provider"),
    validateBody(updateOwnProviderSchema),
    asyncHandler(async (req, res) => {
      await findOrCreateServiceProviderBySub(req.auth!.sub, req.auth!.claims);
      ok(res, await updateOwnProviderProfile(req.auth!.sub, req.body));
    })
  );

  // --- Everything below is provider "dashboard" functionality — gated on
  // BOTH the Cognito `provider` group (via requireRole, already applied)
  // AND the local approval_status (via assertProviderApproved). Neither
  // alone is sufficient (FINAL AUTHENTICATION ARCHITECTURE §6/§10). ---

  router.get(
    "/provider/listings",
    authenticate(),
    requireRole("provider"),
    validateQuery(ownListingsQuerySchema),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateServiceProviderBySub(req.auth!.sub, req.auth!.claims);
      assertProviderApproved(profile);
      const pagination = parsePagination(req.query as Record<string, unknown>);
      const status = (req.query as { status?: "pending_approval" | "approved" | "rejected" }).status;
      const { items, total } = await listOwnListings(req.auth!.sub, { status }, pagination);
      ok(res, items, buildPageMeta(pagination, total));
    })
  );

  router.get(
    "/provider/listings/:id",
    authenticate(),
    requireRole("provider"),
    validateParams(serviceIdParamsSchema),
    requireOwnership((req) => getServiceOwnerSub(req.params.id!)),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateServiceProviderBySub(req.auth!.sub, req.auth!.claims);
      assertProviderApproved(profile);
      const service = await getManagedServiceById(req.params.id!);
      if (!service) throw new NotFoundError("Listing not found.");
      ok(res, service);
    })
  );

  router.post(
    "/provider/listings",
    authenticate(),
    requireRole("provider"),
    validateBody(createServiceSchema),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateServiceProviderBySub(req.auth!.sub, req.auth!.claims);
      assertProviderApproved(profile);
      const service = await createService(req.body, "provider", req.auth!.sub);
      created(res, service);
    })
  );

  router.patch(
    "/provider/listings/:id",
    authenticate(),
    requireRole("provider"),
    validateParams(serviceIdParamsSchema),
    requireOwnership((req) => getServiceOwnerSub(req.params.id!)),
    validateBody(updateServiceSchema),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateServiceProviderBySub(req.auth!.sub, req.auth!.claims);
      assertProviderApproved(profile);
      const service = await updateService(req.params.id!, req.body, { role: "provider", sub: req.auth!.sub });
      ok(res, service);
    })
  );

  // --- Admin management of providers (approval pipeline lives here) ---

  router.get(
    "/admin/providers",
    authenticate(),
    requireRole("admin"),
    validateQuery(listProvidersQuerySchema),
    asyncHandler(async (req, res) => {
      const pagination = parsePagination(req.query as Record<string, unknown>);
      const q = req.query as { search?: string; approvalStatus?: "pending_approval" | "approved" | "rejected" };
      const { items, total } = await listServiceProviders(q.search, q.approvalStatus, pagination);
      ok(res, items, buildPageMeta(pagination, total));
    })
  );

  router.patch(
    "/admin/providers/:id",
    authenticate(),
    requireRole("admin"),
    validateParams(providerIdParamsSchema),
    validateBody(setAccountStatusSchema),
    asyncHandler(async (req, res) => {
      ok(res, await setProviderAccountStatus(req.params.id!, req.body.accountStatus));
    })
  );

  /** The ONLY role allowed to approve providers — enforced by requireRole("admin"), never by anything the frontend sends. */
  router.post(
    "/admin/providers/:id/approve",
    authenticate(),
    requireRole("admin"),
    validateParams(providerIdParamsSchema),
    asyncHandler(async (req, res) => {
      ok(res, await approveProvider(req.params.id!, req.auth!.sub));
    })
  );

  router.post(
    "/admin/providers/:id/reject",
    authenticate(),
    requireRole("admin"),
    validateParams(providerIdParamsSchema),
    validateBody(rejectProviderSchema),
    asyncHandler(async (req, res) => {
      ok(res, await rejectProvider(req.params.id!, req.auth!.sub, req.body.reason));
    })
  );

  return router;
}
