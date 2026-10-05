import { Router } from "express";
import { asyncHandler } from "../../shared/asyncHandler";
import { created, ok } from "../../shared/response";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/authorize";
import { validateBody, validateParams } from "../../middleware/validate";
import { findOrCreateCustomerBySub } from "../customers/customers.service";
import { addCartItemSchema, cartItemIdParamsSchema, mergeCartSchema, updateCartItemSchema } from "./cart.schema";
import { addCartItem, getCart, mergeLocalCart, removeCartItem, setCartItemQuantity } from "./cart.service";

export function cartRouter(): Router {
  const router = Router();

  router.get(
    "/customer/cart",
    authenticate(),
    requireRole("customer"),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateCustomerBySub(req.auth!.sub, req.auth!.claims);
      ok(res, await getCart(profile.id));
    })
  );

  router.post(
    "/customer/cart/items",
    authenticate(),
    requireRole("customer"),
    validateBody(addCartItemSchema),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateCustomerBySub(req.auth!.sub, req.auth!.claims);
      created(res, await addCartItem(profile.id, req.body));
    })
  );

  router.patch(
    "/customer/cart/items/:id",
    authenticate(),
    requireRole("customer"),
    validateParams(cartItemIdParamsSchema),
    validateBody(updateCartItemSchema),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateCustomerBySub(req.auth!.sub, req.auth!.claims);
      ok(res, await setCartItemQuantity(profile.id, req.params.id!, req.body.quantity));
    })
  );

  router.delete(
    "/customer/cart/items/:id",
    authenticate(),
    requireRole("customer"),
    validateParams(cartItemIdParamsSchema),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateCustomerBySub(req.auth!.sub, req.auth!.claims);
      ok(res, await removeCartItem(profile.id, req.params.id!));
    })
  );

  /**
   * Called once, right after login/signup, with the frontend's anonymous
   * local cart — the "login-required-at-checkout" flow's merge step
   * (PHASE_3 brief). Never creates or touches an order.
   */
  router.post(
    "/customer/cart/merge",
    authenticate(),
    requireRole("customer"),
    validateBody(mergeCartSchema),
    asyncHandler(async (req, res) => {
      const profile = await findOrCreateCustomerBySub(req.auth!.sub, req.auth!.claims);
      const { cart, skipped } = await mergeLocalCart(profile.id, req.body.items);
      ok(res, cart, skipped.length > 0 ? { skipped } : undefined);
    })
  );

  return router;
}
