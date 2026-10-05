import { Router } from "express";
import { asyncHandler } from "../../shared/asyncHandler";
import { created, ok, parsePagination, buildPageMeta } from "../../shared/response";
import { authenticate } from "../../middleware/authenticate";
import { requireOwnership, requireRole } from "../../middleware/authorize";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate";
import { findOrCreateCustomerBySub } from "../customers/customers.service";
import {
  createOrderSchema,
  listOrdersQuerySchema,
  orderIdParamsSchema,
  updateOrderStatusSchema,
} from "./orders.schema";
import {
  createOrder,
  getOrderOwnerSub,
  getOrderStats,
  getOwnOrderById,
  listAllOrders,
  listOwnOrders,
  updateOrderStatus,
} from "./orders.service";
import type { OrderStatus } from "./orders.types";

export function ordersRouter(): Router {
  const router = Router();

  // --- Customer: create + view own orders only ---

  router.post(
    "/customer/orders",
    authenticate(),
    requireRole("customer"),
    validateBody(createOrderSchema),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateCustomerBySub(req.auth!.sub, req.auth!.claims);
      const order = await createOrder(profile.id, req.body);
      created(res, order);
    })
  );

  router.get(
    "/customer/orders",
    authenticate(),
    requireRole("customer"),
    validateQuery(listOrdersQuerySchema),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateCustomerBySub(req.auth!.sub, req.auth!.claims);
      const pagination = parsePagination(req.query as Record<string, unknown>);
      const { items, total } = await listOwnOrders(profile.id, pagination);
      ok(res, items, buildPageMeta(pagination, total));
    })
  );

  router.get(
    "/customer/orders/:id",
    authenticate(),
    requireRole("customer"),
    validateParams(orderIdParamsSchema),
    requireOwnership((req) => getOrderOwnerSub(req.params.id!)),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateCustomerBySub(req.auth!.sub, req.auth!.claims);
      ok(res, await getOwnOrderById(profile.id, req.params.id!));
    })
  );

  // --- Admin: operational read access + status/provider-assignment updates ---

  router.get(
    "/admin/orders",
    authenticate(),
    requireRole("admin"),
    validateQuery(listOrdersQuerySchema),
    asyncHandler(async (req, res) => {
      const pagination = parsePagination(req.query as Record<string, unknown>);
      const status = (req.query as { status?: OrderStatus }).status;
      const { items, total } = await listAllOrders({ status }, pagination);
      ok(res, items, buildPageMeta(pagination, total));
    })
  );

  router.get(
    "/admin/orders/stats",
    authenticate(),
    requireRole("admin"),
    asyncHandler(async (_req, res) => {
      ok(res, await getOrderStats());
    })
  );

  router.patch(
    "/admin/orders/:id",
    authenticate(),
    requireRole("admin"),
    validateParams(orderIdParamsSchema),
    validateBody(updateOrderStatusSchema),
    asyncHandler(async (req, res) => {
      ok(res, await updateOrderStatus(req.params.id!, req.body.status, req.body.providerId));
    })
  );

  return router;
}
