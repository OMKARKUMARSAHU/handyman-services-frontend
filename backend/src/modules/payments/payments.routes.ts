import { Router } from "express";
import { asyncHandler } from "../../shared/asyncHandler";
import { created, ok } from "../../shared/response";
import { authenticate } from "../../middleware/authenticate";
import { requireOwnership, requireRole } from "../../middleware/authorize";
import { validateBody, validateParams } from "../../middleware/validate";
import { findOrCreateCustomerBySub } from "../customers/customers.service";
import { getOrderOwnerSub } from "../orders/orders.service";
import { orderIdParamsSchema, razorpayFailedSchema, razorpayVerifySchema } from "./payments.schema";
import { createRazorpayOrderForOrder, markRazorpayPaymentFailed, verifyRazorpayPayment } from "./payments.service";

/**
 * Razorpay (TEST MODE) payment routes for an existing order. Every route
 * here is customer-authenticated AND ownership-checked
 * (`requireOwnership(getOrderOwnerSub)`, the same guard `/customer/orders/:id`
 * already uses) BEFORE the handler runs — a customer can only ever create,
 * verify, or report a failed payment for their OWN order, never another
 * customer's. Mounted under the orders module's own `/customer/orders/:id`
 * prefix, not a separate `/payments` tree, since a payment attempt only
 * ever exists in the context of one specific order.
 */
export function paymentsRouter(): Router {
  const router = Router();

  router.post(
    "/customer/orders/:id/payment/razorpay-order",
    authenticate(),
    requireRole("customer"),
    validateParams(orderIdParamsSchema),
    requireOwnership((req) => getOrderOwnerSub(req.params.id!)),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateCustomerBySub(req.auth!.sub, req.auth!.claims);
      created(res, await createRazorpayOrderForOrder(profile.id, req.params.id!));
    })
  );

  router.post(
    "/customer/orders/:id/payment/razorpay-verify",
    authenticate(),
    requireRole("customer"),
    validateParams(orderIdParamsSchema),
    requireOwnership((req) => getOrderOwnerSub(req.params.id!)),
    validateBody(razorpayVerifySchema),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateCustomerBySub(req.auth!.sub, req.auth!.claims);
      ok(res, await verifyRazorpayPayment(profile.id, req.params.id!, req.body));
    })
  );

  router.post(
    "/customer/orders/:id/payment/razorpay-failed",
    authenticate(),
    requireRole("customer"),
    validateParams(orderIdParamsSchema),
    requireOwnership((req) => getOrderOwnerSub(req.params.id!)),
    validateBody(razorpayFailedSchema),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateCustomerBySub(req.auth!.sub, req.auth!.claims);
      await markRazorpayPaymentFailed(profile.id, req.params.id!, req.body.razorpayOrderId);
      ok(res, { acknowledged: true });
    })
  );

  return router;
}
