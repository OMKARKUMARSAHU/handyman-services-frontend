import { Router } from "express";
import { asyncHandler } from "../../shared/asyncHandler";
import { created, ok, parsePagination, buildPageMeta } from "../../shared/response";
import { authenticate } from "../../middleware/authenticate";
import { requireOwnership, requireRole } from "../../middleware/authorize";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate";
import {
  customerIdParamsSchema,
  listCustomersQuerySchema,
  setCustomerAccountStatusSchema,
  updateOwnCustomerSchema,
} from "./customers.schema";
import {
  findOrCreateCustomerBySub,
  listCustomers,
  setCustomerAccountStatus,
  updateOwnCustomerProfile,
} from "./customers.service";
import { addressIdParamsSchema, createAddressSchema, updateAddressSchema } from "./addresses.schema";
import {
  createOwnAddress,
  deleteOwnAddress,
  getAddressOwnerSub,
  listOwnAddresses,
  updateOwnAddress,
} from "./addresses.service";

export function customersRouter(): Router {
  const router = Router();

  router.get(
    "/customer/me",
    authenticate(),
    requireRole("customer"),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateCustomerBySub(req.auth!.sub, req.auth!.claims);
      ok(res, profile);
    })
  );

  router.patch(
    "/customer/me",
    authenticate(),
    requireRole("customer"),
    validateBody(updateOwnCustomerSchema),
    asyncHandler(async (req, res) => {
      await findOrCreateCustomerBySub(req.auth!.sub, req.auth!.claims);
      ok(res, await updateOwnCustomerProfile(req.auth!.sub, req.body));
    })
  );

  // --- Own addresses (authenticated customer, own rows only) ---

  router.get(
    "/customer/addresses",
    authenticate(),
    requireRole("customer"),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateCustomerBySub(req.auth!.sub, req.auth!.claims);
      ok(res, await listOwnAddresses(profile.id));
    })
  );

  router.post(
    "/customer/addresses",
    authenticate(),
    requireRole("customer"),
    validateBody(createAddressSchema),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateCustomerBySub(req.auth!.sub, req.auth!.claims);
      created(res, await createOwnAddress(profile.id, req.body));
    })
  );

  router.patch(
    "/customer/addresses/:id",
    authenticate(),
    requireRole("customer"),
    validateParams(addressIdParamsSchema),
    requireOwnership((req) => getAddressOwnerSub(req.params.id!)),
    validateBody(updateAddressSchema),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateCustomerBySub(req.auth!.sub, req.auth!.claims);
      ok(res, await updateOwnAddress(profile.id, req.params.id!, req.body));
    })
  );

  router.delete(
    "/customer/addresses/:id",
    authenticate(),
    requireRole("customer"),
    validateParams(addressIdParamsSchema),
    requireOwnership((req) => getAddressOwnerSub(req.params.id!)),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateCustomerBySub(req.auth!.sub, req.auth!.claims);
      await deleteOwnAddress(profile.id, req.params.id!);
      ok(res, { deleted: true });
    })
  );

  // --- Admin management of customers ---

  router.get(
    "/admin/customers",
    authenticate(),
    requireRole("admin"),
    validateQuery(listCustomersQuerySchema),
    asyncHandler(async (req, res) => {
      const pagination = parsePagination(req.query as Record<string, unknown>);
      const search = (req.query as { search?: string }).search;
      const { items, total } = await listCustomers(search, pagination);
      ok(res, items, buildPageMeta(pagination, total));
    })
  );

  router.patch(
    "/admin/customers/:id",
    authenticate(),
    requireRole("admin"),
    validateParams(customerIdParamsSchema),
    validateBody(setCustomerAccountStatusSchema),
    asyncHandler(async (req, res) => {
      ok(res, await setCustomerAccountStatus(req.params.id!, req.body.accountStatus));
    })
  );

  return router;
}
