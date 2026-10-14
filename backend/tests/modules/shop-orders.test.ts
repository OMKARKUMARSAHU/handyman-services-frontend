import { randomUUID } from "node:crypto";
import { testAgent } from "../helpers/testApp";
import { getDb } from "../../src/database/db";
import { resetDatabase } from "../helpers/db";
import { bearer, mintToken } from "../helpers/cognitoTestKit";
import { seedCustomerWithAddress, seedShopCategory, seedShopCity, seedShopProduct } from "../helpers/shopFactories";
import { env } from "../../src/config/env";
import { createShopOrder, expireStalePendingShopOrders } from "../../src/modules/shop/shopOrders.service";
import { computeCheckoutSignature, computeWebhookSignature } from "../../src/modules/shop/shopPayments.service";
import { updateShopSettings } from "../../src/modules/shop/shopSettings.service";

// The Razorpay SDK would call the network; replace only the client factory.
jest.mock("../../src/modules/payments/payments.service", () => {
  const actual = jest.requireActual("../../src/modules/payments/payments.service");
  let n = 0;
  return {
    ...actual,
    getRazorpayClient: () => ({ orders: { create: async () => ({ id: `order_TEST${++n}` }) } }),
  };
});

const KEY_SECRET = "unit_test_key_secret";
const WEBHOOK_SECRET = "unit_test_webhook_secret";

describe("shop cart, orders and payments", () => {
  const adminToken = mintToken({ role: "admin" });

  beforeAll(() => {
    (env as { RAZORPAY_KEY_ID?: string }).RAZORPAY_KEY_ID = "rzp_test_unitTestKey";
    (env as { RAZORPAY_KEY_SECRET?: string }).RAZORPAY_KEY_SECRET = KEY_SECRET;
    (env as { RAZORPAY_WEBHOOK_SECRET?: string }).RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  let citySlug = "";
  beforeEach(async () => {
    await resetDatabase();
    citySlug = (await seedShopCity()).slug;
  });

  async function buyer() {
    const b = await seedCustomerWithAddress();
    return { ...b, token: mintToken({ role: "customer", sub: b.sub }) };
  }

  const placeOrder = (token: string, addressId: string, items: Array<{ productId: string; quantity: number }>, key = randomUUID()) =>
    testAgent().post("/api/v1/customer/shop/orders").set("Authorization", bearer(token)).send({ items, addressId, idempotencyKey: key, city: citySlug });

  const stockOf = async (id: string) => Number((await getDb()("shop_products").where({ id }).first("stock_quantity")).stock_quantity);

  describe("cart pricing (server is the source of truth)", () => {
    it("re-prices from the database and ignores any client-sent price", async () => {
      const cat = await seedShopCategory();
      const p = await seedShopProduct(cat.id, { price: 250.5 });
      const res = await testAgent()
        .post("/api/v1/shop/cart/price")
        .send({ items: [{ productId: p.id, quantity: 3, price: 1, unitPrice: 1 }], city: citySlug });
      expect(res.status).toBe(200);
      expect(res.body.data.lines[0]).toMatchObject({ unitPrice: 250.5, quantity: 3, lineTotal: 751.5, available: true });
      expect(res.body.data).toMatchObject({ subtotal: 751.5, deliveryCharge: 0, total: 751.5, canCheckout: true });
    });

    it("applies the admin-configured delivery charge and free-delivery threshold", async () => {
      const cat = await seedShopCategory();
      const cheap = await seedShopProduct(cat.id, { price: 200 });
      const dear = await seedShopProduct(cat.id, { price: 1200 });
      await updateShopSettings({ deliveryCharge: 60, freeDeliveryThreshold: 1000 });
      const small = await testAgent().post("/api/v1/shop/cart/price").send({ items: [{ productId: cheap.id, quantity: 1 }], city: citySlug });
      expect(small.body.data).toMatchObject({ subtotal: 200, deliveryCharge: 60, total: 260 });
      const big = await testAgent().post("/api/v1/shop/cart/price").send({ items: [{ productId: dear.id, quantity: 1 }], city: citySlug });
      expect(big.body.data).toMatchObject({ subtotal: 1200, deliveryCharge: 0, total: 1200 });
    });

    it("merges duplicate lines and flags out-of-stock, over-quantity, draft and unknown products", async () => {
      const cat = await seedShopCategory();
      const ok = await seedShopProduct(cat.id, { price: 10, stock: 5 });
      const out = await seedShopProduct(cat.id, { stock: 0 });
      const few = await seedShopProduct(cat.id, { stock: 2 });
      const draft = await seedShopProduct(cat.id, { status: "draft" });
      const res = await testAgent()
        .post("/api/v1/shop/cart/price")
        .send({
          items: [
            { productId: ok.id, quantity: 1 },
            { productId: ok.id, quantity: 2 },
            { productId: out.id, quantity: 1 },
            { productId: few.id, quantity: 3 },
            { productId: draft.id, quantity: 1 },
            { productId: randomUUID(), quantity: 1 },
          ],
          city: citySlug,
        });
      const lines = res.body.data.lines as Array<{ productId: string; quantity: number; available: boolean; issue: string | null }>;
      expect(lines.find((l) => l.productId === ok.id)).toMatchObject({ quantity: 3, available: true });
      expect(lines.find((l) => l.productId === out.id)).toMatchObject({ available: false, issue: "Out of stock." });
      expect(lines.find((l) => l.productId === few.id)).toMatchObject({ available: false, issue: "Only 2 available." });
      expect(lines.find((l) => l.productId === draft.id)?.available).toBe(false);
      expect(res.body.data.canCheckout).toBe(false);
      expect(res.body.data.subtotal).toBe(30);
    });

    it("rejects malformed carts", async () => {
      const bad = (items: unknown) => testAgent().post("/api/v1/shop/cart/price").send({ items });
      expect((await bad([])).status).toBe(400);
      expect((await bad([{ productId: "nope", quantity: 1 }])).status).toBe(400);
      expect((await bad([{ productId: randomUUID(), quantity: 0 }])).status).toBe(400);
      expect((await bad([{ productId: randomUUID(), quantity: 21 }])).status).toBe(400);
    });
  });

  describe("order creation", () => {
    it("requires a signed-in customer", async () => {
      const res = await testAgent().post("/api/v1/customer/shop/orders").send({ items: [], addressId: randomUUID(), idempotencyKey: "12345678" });
      expect(res.status).toBe(401);
      const admin = await testAgent().post("/api/v1/customer/shop/orders").set("Authorization", bearer(adminToken)).send({});
      expect(admin.status).toBe(403);
    });

    it("creates an order with server-computed totals, snapshots data and reserves stock", async () => {
      const cat = await seedShopCategory();
      const a = await seedShopProduct(cat.id, { price: 100, stock: 10 });
      const b = await seedShopProduct(cat.id, { price: 49.99, stock: 4 });
      await updateShopSettings({ deliveryCharge: 40, freeDeliveryThreshold: 1000 });
      const { token, address } = await buyer();

      const res = await placeOrder(token, address.id, [
        { productId: a.id, quantity: 2 },
        { productId: b.id, quantity: 1 },
      ]);
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ status: "pending_payment", paymentStatus: "unpaid", subtotal: 249.99, deliveryCharge: 40, total: 289.99 });
      expect(res.body.data.orderNumber).toMatch(/^SHOP-\d{8}-[0-9A-F]{8}$/);
      expect(res.body.data.shipping).toMatchObject({ line1: "221B Test Lane", pincode: "560001" });
      expect(res.body.data.items).toHaveLength(2);
      expect(await stockOf(a.id)).toBe(8);
      expect(await stockOf(b.id)).toBe(3);

      // Snapshot: later catalogue edits never change a placed order.
      await getDb()("shop_products").where({ id: a.id }).update({ price: 999, name: "Renamed" });
      const again = await testAgent().get(`/api/v1/customer/shop/orders/${res.body.data.id}`).set("Authorization", bearer(token));
      expect(again.body.data.items.find((i: { productId: string }) => i.productId === a.id)).toMatchObject({ unitPrice: 100, quantity: 2 });
      expect(again.body.data.items.find((i: { productId: string }) => i.productId === a.id).productName).not.toBe("Renamed");
    });

    it("is idempotent for a repeated idempotency key and never double-reserves stock", async () => {
      const cat = await seedShopCategory();
      const p = await seedShopProduct(cat.id, { stock: 10 });
      const { token, address } = await buyer();
      const key = randomUUID();
      const first = await placeOrder(token, address.id, [{ productId: p.id, quantity: 2 }], key);
      const second = await placeOrder(token, address.id, [{ productId: p.id, quantity: 2 }], key);
      expect(second.body.data.id).toBe(first.body.data.id);
      expect(await stockOf(p.id)).toBe(8);
      expect(Number((await getDb()("shop_orders").count({ n: "id" }).first())?.n)).toBe(1);
    });

    it("rejects out-of-stock, over-stock, draft/inactive products and someone else's address — without touching stock", async () => {
      const cat = await seedShopCategory();
      const out = await seedShopProduct(cat.id, { stock: 0 });
      const few = await seedShopProduct(cat.id, { stock: 2 });
      const draft = await seedShopProduct(cat.id, { status: "draft" });
      const ok = await seedShopProduct(cat.id, { stock: 5 });
      const me = await buyer();
      const other = await buyer();

      expect((await placeOrder(me.token, me.address.id, [{ productId: out.id, quantity: 1 }])).status).toBe(409);
      expect((await placeOrder(me.token, me.address.id, [{ productId: few.id, quantity: 3 }])).status).toBe(409);
      expect((await placeOrder(me.token, me.address.id, [{ productId: draft.id, quantity: 1 }])).status).toBe(409);
      // A failing line rolls back the whole order, including lines that were fine.
      expect((await placeOrder(me.token, me.address.id, [{ productId: ok.id, quantity: 2 }, { productId: out.id, quantity: 1 }])).status).toBe(409);
      expect(await stockOf(ok.id)).toBe(5);
      expect((await placeOrder(me.token, other.address.id, [{ productId: ok.id, quantity: 1 }])).status).toBe(404);
      expect(await stockOf(ok.id)).toBe(5);
    });

    it("does not decrement stock for products that don't track inventory", async () => {
      const cat = await seedShopCategory();
      const p = await seedShopProduct(cat.id, { stock: 0, track: false });
      const { token, address } = await buyer();
      expect((await placeOrder(token, address.id, [{ productId: p.id, quantity: 3 }])).status).toBe(201);
      expect(await stockOf(p.id)).toBe(0);
    });

    it("NEVER oversells under concurrent checkouts of the last units", async () => {
      const cat = await seedShopCategory();
      const p = await seedShopProduct(cat.id, { stock: 3 });
      const buyers = await Promise.all(Array.from({ length: 8 }, () => seedCustomerWithAddress()));
      const results = await Promise.allSettled(
        buyers.map((b) => createShopOrder(b.customer.id, { items: [{ productId: p.id, quantity: 1 }], addressId: b.address.id, idempotencyKey: randomUUID(), city: citySlug }))
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      expect(succeeded).toBe(3);
      expect(await stockOf(p.id)).toBe(0);
      expect(Number((await getDb()("shop_orders").count({ n: "id" }).first())?.n)).toBe(3);
    });

    it("lets customers see only their own orders", async () => {
      const cat = await seedShopCategory();
      const p = await seedShopProduct(cat.id);
      const a = await buyer();
      const b = await buyer();
      const order = await placeOrder(a.token, a.address.id, [{ productId: p.id, quantity: 1 }]);
      expect((await testAgent().get(`/api/v1/customer/shop/orders/${order.body.data.id}`).set("Authorization", bearer(b.token))).status).toBe(404);
      const mine = await testAgent().get("/api/v1/customer/shop/orders").set("Authorization", bearer(a.token));
      expect(mine.body.data).toHaveLength(1);
      const theirs = await testAgent().get("/api/v1/customer/shop/orders").set("Authorization", bearer(b.token));
      expect(theirs.body.data).toHaveLength(0);
    });

    it("lets a customer cancel an unpaid order and returns the stock exactly once", async () => {
      const cat = await seedShopCategory();
      const p = await seedShopProduct(cat.id, { stock: 5 });
      const { token, address } = await buyer();
      const order = await placeOrder(token, address.id, [{ productId: p.id, quantity: 2 }]);
      expect(await stockOf(p.id)).toBe(3);
      const url = `/api/v1/customer/shop/orders/${order.body.data.id}/cancel`;
      const cancel = await testAgent().post(url).set("Authorization", bearer(token));
      expect(cancel.body.data.status).toBe("cancelled");
      expect(await stockOf(p.id)).toBe(5);
      expect((await testAgent().post(url).set("Authorization", bearer(token))).status).toBe(409);
      expect(await stockOf(p.id)).toBe(5);
    });

    it("expires stale unpaid orders and releases their stock (idempotent)", async () => {
      const cat = await seedShopCategory();
      const p = await seedShopProduct(cat.id, { stock: 5 });
      const { token, address } = await buyer();
      const order = await placeOrder(token, address.id, [{ productId: p.id, quantity: 2 }]);
      await getDb()("shop_orders").where({ id: order.body.data.id }).update({ created_at: new Date(Date.now() - 3 * 3600_000) });
      expect(await expireStalePendingShopOrders(60)).toBe(1);
      expect(await expireStalePendingShopOrders(60)).toBe(0);
      expect(await stockOf(p.id)).toBe(5);
      const after = await testAgent().get(`/api/v1/customer/shop/orders/${order.body.data.id}`).set("Authorization", bearer(token));
      expect(after.body.data).toMatchObject({ status: "cancelled", cancelReason: "Payment not completed in time" });
    });
  });

  describe("payments", () => {
    async function orderWithRazorpay() {
      const cat = await seedShopCategory();
      const p = await seedShopProduct(cat.id, { price: 500, stock: 5 });
      const b = await buyer();
      const order = await placeOrder(b.token, b.address.id, [{ productId: p.id, quantity: 2 }]);
      const rz = await testAgent().post(`/api/v1/customer/shop/orders/${order.body.data.id}/payment/razorpay-order`).set("Authorization", bearer(b.token));
      return { ...b, p, order: order.body.data, rz: rz.body.data, orderUrl: `/api/v1/customer/shop/orders/${order.body.data.id}` };
    }

    it("creates a gateway order for the server-side total and marks the order payment as pending", async () => {
      const { rz, order, token, orderUrl } = await orderWithRazorpay();
      expect(rz).toMatchObject({ amount: 100000, currency: "INR", orderId: order.id });
      expect(rz.razorpayOrderId).toMatch(/^order_TEST/);
      expect(JSON.stringify(rz)).not.toContain(KEY_SECRET);
      const got = await testAgent().get(orderUrl).set("Authorization", bearer(token));
      expect(got.body.data).toMatchObject({ status: "pending_payment", paymentStatus: "pending" });
    });

    it("refuses to create payment attempts for someone else's order", async () => {
      const { order } = await orderWithRazorpay();
      const stranger = await buyer();
      const res = await testAgent().post(`/api/v1/customer/shop/orders/${order.id}/payment/razorpay-order`).set("Authorization", bearer(stranger.token));
      expect(res.status).toBe(404);
    });

    it("marks the order paid ONLY with a valid signature (browser callback)", async () => {
      const { rz, order, token, orderUrl } = await orderWithRazorpay();
      const verify = (body: object) => testAgent().post(`${orderUrl}/payment/razorpay-verify`).set("Authorization", bearer(token)).send(body);

      const bad = await verify({ razorpay_order_id: rz.razorpayOrderId, razorpay_payment_id: "pay_1", razorpay_signature: "deadbeef" });
      expect(bad.status).toBe(400);
      let current = await testAgent().get(orderUrl).set("Authorization", bearer(token));
      expect(current.body.data).toMatchObject({ status: "pending_payment", paymentStatus: "pending" });

      const wrongSecret = computeCheckoutSignature(rz.razorpayOrderId, "pay_1", "another_secret");
      expect((await verify({ razorpay_order_id: rz.razorpayOrderId, razorpay_payment_id: "pay_1", razorpay_signature: wrongSecret })).status).toBe(400);

      const good = computeCheckoutSignature(rz.razorpayOrderId, "pay_1", KEY_SECRET);
      const ok = await verify({ razorpay_order_id: rz.razorpayOrderId, razorpay_payment_id: "pay_1", razorpay_signature: good });
      expect(ok.status).toBe(200);
      current = await testAgent().get(orderUrl).set("Authorization", bearer(token));
      expect(current.body.data).toMatchObject({ status: "paid", paymentStatus: "paid" });

      // Replaying the same callback is harmless.
      expect((await verify({ razorpay_order_id: rz.razorpayOrderId, razorpay_payment_id: "pay_1", razorpay_signature: good })).status).toBe(200);
      const row = await getDb()("shop_payments").where({ order_id: order.id }).first();
      expect(row).toMatchObject({ status: "succeeded", provider_payment_id: "pay_1" });
      expect(Boolean(row.signature_verified)).toBe(true);
    });

    it("cannot verify a payment against a gateway order that belongs to a different shop order", async () => {
      const a = await orderWithRazorpay();
      const b = await orderWithRazorpay();
      const sig = computeCheckoutSignature(b.rz.razorpayOrderId, "pay_x", KEY_SECRET);
      const res = await testAgent()
        .post(`${a.orderUrl}/payment/razorpay-verify`)
        .set("Authorization", bearer(a.token))
        .send({ razorpay_order_id: b.rz.razorpayOrderId, razorpay_payment_id: "pay_x", razorpay_signature: sig });
      expect(res.status).toBe(409);
    });

    it("a client-reported failure never marks paid; it only closes the open attempt", async () => {
      const { rz, token, orderUrl } = await orderWithRazorpay();
      const res = await testAgent().post(`${orderUrl}/payment/razorpay-failed`).set("Authorization", bearer(token)).send({ razorpayOrderId: rz.razorpayOrderId });
      expect(res.status).toBe(200);
      const current = await testAgent().get(orderUrl).set("Authorization", bearer(token));
      expect(current.body.data).toMatchObject({ status: "pending_payment", paymentStatus: "failed" });
      // The customer can retry with a fresh gateway order.
      const retry = await testAgent().post(`${orderUrl}/payment/razorpay-order`).set("Authorization", bearer(token));
      expect(retry.status).toBe(201);
      expect(retry.body.data.razorpayOrderId).not.toBe(rz.razorpayOrderId);
    });

    describe("webhook", () => {
      const send = (payload: object, opts: { secret?: string; eventId?: string; signature?: string } = {}) => {
        const raw = JSON.stringify(payload);
        const sig = opts.signature ?? computeWebhookSignature(raw, opts.secret ?? WEBHOOK_SECRET);
        const req = testAgent().post("/api/v1/shop/webhooks/razorpay").set("Content-Type", "application/json").set("x-razorpay-signature", sig);
        if (opts.eventId) req.set("x-razorpay-event-id", opts.eventId);
        return req.send(raw);
      };
      const captured = (rzOrderId: string, amount: number, payId = "pay_wh1") => ({
        event: "payment.captured",
        payload: { payment: { entity: { id: payId, order_id: rzOrderId, amount, status: "captured" } } },
      });

      it("rejects a missing or invalid signature and changes nothing", async () => {
        const { rz, token, orderUrl } = await orderWithRazorpay();
        const body = captured(rz.razorpayOrderId, 100000);
        expect((await send(body, { signature: "bad" })).status).toBe(400);
        expect((await send(body, { secret: "wrong_secret" })).status).toBe(400);
        const noSig = await testAgent().post("/api/v1/shop/webhooks/razorpay").set("Content-Type", "application/json").send(JSON.stringify(body));
        expect(noSig.status).toBe(400);
        const current = await testAgent().get(orderUrl).set("Authorization", bearer(token));
        expect(current.body.data.paymentStatus).toBe("pending");
        expect(Number((await getDb()("shop_payment_events").count({ n: "id" }).first())?.n)).toBe(0);
      });

      it("answers 503 when no webhook secret is configured", async () => {
        const saved = env.RAZORPAY_WEBHOOK_SECRET;
        (env as { RAZORPAY_WEBHOOK_SECRET?: string }).RAZORPAY_WEBHOOK_SECRET = undefined;
        try {
          const res = await send({ event: "x" });
          expect(res.status).toBe(503);
        } finally {
          (env as { RAZORPAY_WEBHOOK_SECRET?: string }).RAZORPAY_WEBHOOK_SECRET = saved;
        }
      });

      it("marks the order paid on a verified payment.captured and is idempotent on replay", async () => {
        const { rz, token, orderUrl, order } = await orderWithRazorpay();
        const body = captured(rz.razorpayOrderId, 100000);
        const first = await send(body, { eventId: "evt_1" });
        expect(first.status).toBe(200);
        expect(first.body.data.status).toBe("processed");
        const current = await testAgent().get(orderUrl).set("Authorization", bearer(token));
        expect(current.body.data).toMatchObject({ status: "paid", paymentStatus: "paid" });

        const replay = await send(body, { eventId: "evt_1" });
        expect(replay.status).toBe(200);
        expect(replay.body.data.status).toBe("duplicate");
        // A different event id for the same payment (gateway re-sends as order.paid) is also a no-op.
        const second = await send({ event: "order.paid", payload: { payment: { entity: { id: "pay_wh1", order_id: rz.razorpayOrderId, amount: 100000 } } } }, { eventId: "evt_2" });
        expect(second.body.data.result).toBe("already_paid");
        expect(Number((await getDb()("shop_payments").where({ order_id: order.id, status: "succeeded" }).count({ n: "id" }).first())?.n)).toBe(1);
      });

      it("handles the browser callback and the webhook racing for the same payment", async () => {
        const { rz, token, orderUrl } = await orderWithRazorpay();
        const sig = computeCheckoutSignature(rz.razorpayOrderId, "pay_race", KEY_SECRET);
        const [a, b] = await Promise.all([
          testAgent().post(`${orderUrl}/payment/razorpay-verify`).set("Authorization", bearer(token)).send({ razorpay_order_id: rz.razorpayOrderId, razorpay_payment_id: "pay_race", razorpay_signature: sig }),
          send(captured(rz.razorpayOrderId, 100000, "pay_race"), { eventId: "evt_race" }),
        ]);
        expect(a.status).toBe(200);
        expect(b.status).toBe(200);
        const current = await testAgent().get(orderUrl).set("Authorization", bearer(token));
        expect(current.body.data).toMatchObject({ status: "paid", paymentStatus: "paid" });
      });

      it("refuses to mark paid when the gateway amount differs from the order total", async () => {
        const { rz, token, orderUrl } = await orderWithRazorpay();
        const res = await send(captured(rz.razorpayOrderId, 100), { eventId: "evt_amt" });
        expect(res.body.data.result).toBe("amount_mismatch");
        const current = await testAgent().get(orderUrl).set("Authorization", bearer(token));
        expect(current.body.data).toMatchObject({ status: "pending_payment" });
        expect(current.body.data.paymentStatus).not.toBe("paid");
      });

      it("records payment.failed without cancelling the order, and ignores unknown events/orders", async () => {
        const { rz, token, orderUrl } = await orderWithRazorpay();
        const failed = await send({ event: "payment.failed", payload: { payment: { entity: { id: "pay_f", order_id: rz.razorpayOrderId, error_description: "Card declined" } } } }, { eventId: "evt_f" });
        expect(failed.status).toBe(200);
        const current = await testAgent().get(orderUrl).set("Authorization", bearer(token));
        expect(current.body.data).toMatchObject({ status: "pending_payment", paymentStatus: "failed" });
        expect((await send({ event: "refund.created", payload: {} }, { eventId: "evt_other" })).body.data.status).toBe("ignored");
        expect((await send(captured("order_UNKNOWN", 100), { eventId: "evt_unknown" })).body.data.result).toBe("unknown_order");
      });

      it("records a genuine payment that lands after the order was cancelled (for admin refund) without reopening the order", async () => {
        const { rz, token, orderUrl, p } = await orderWithRazorpay();
        await testAgent().post(`${orderUrl}/cancel`).set("Authorization", bearer(token));
        const res = await send(captured(rz.razorpayOrderId, 100000), { eventId: "evt_late" });
        expect(res.body.data.result).toBe("paid_after_cancel");
        const current = await testAgent().get(orderUrl).set("Authorization", bearer(token));
        expect(current.body.data).toMatchObject({ status: "cancelled", paymentStatus: "paid" });
        expect(await stockOf(p.id)).toBe(5); // stock was returned at cancel, not re-taken
      });
    });
  });

  describe("admin order management", () => {
    async function paidOrder() {
      const cat = await seedShopCategory();
      const p = await seedShopProduct(cat.id, { price: 300, stock: 5 });
      const b = await buyer();
      const order = await placeOrder(b.token, b.address.id, [{ productId: p.id, quantity: 2 }]);
      const rz = await testAgent().post(`/api/v1/customer/shop/orders/${order.body.data.id}/payment/razorpay-order`).set("Authorization", bearer(b.token));
      const sig = computeCheckoutSignature(rz.body.data.razorpayOrderId, "pay_a", KEY_SECRET);
      await testAgent()
        .post(`/api/v1/customer/shop/orders/${order.body.data.id}/payment/razorpay-verify`)
        .set("Authorization", bearer(b.token))
        .send({ razorpay_order_id: rz.body.data.razorpayOrderId, razorpay_payment_id: "pay_a", razorpay_signature: sig });
      return { ...b, p, id: order.body.data.id as string, number: order.body.data.orderNumber as string };
    }
    const setStatus = (id: string, body: object) => testAgent().patch(`/api/v1/admin/shop/orders/${id}/status`).set("Authorization", bearer(adminToken)).send(body);

    it("lists/searches orders with customer, items and payment details", async () => {
      const o = await paidOrder();
      const list = await testAgent().get("/api/v1/admin/shop/orders").query({ search: o.number }).set("Authorization", bearer(adminToken));
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0]).toMatchObject({ id: o.id, status: "paid", paymentStatus: "paid", total: 600 });
      expect(list.body.data[0].customer.name).toBe("Test Buyer");
      expect(list.body.data[0].payment).toMatchObject({ status: "succeeded", signatureVerified: true });
      expect((await testAgent().get("/api/v1/admin/shop/orders").query({ search: "nomatch" }).set("Authorization", bearer(adminToken))).body.data).toHaveLength(0);
      expect((await testAgent().get("/api/v1/admin/shop/orders").query({ paymentStatus: "paid" }).set("Authorization", bearer(adminToken))).body.data).toHaveLength(1);
      expect((await testAgent().get("/api/v1/admin/shop/orders").query({ status: "shipped" }).set("Authorization", bearer(adminToken))).body.data).toHaveLength(0);
    });

    it("walks the valid fulfilment path with tracking and rejects invalid transitions", async () => {
      const o = await paidOrder();
      expect((await setStatus(o.id, { status: "delivered" })).status).toBe(409); // paid -> delivered not allowed
      expect((await setStatus(o.id, { status: "shipped" })).status).toBe(409); // must be processing first
      expect((await setStatus(o.id, { status: "processing" })).body.data.status).toBe("processing");
      const shipped = await setStatus(o.id, { status: "shipped", trackingCarrier: "BlueDart", trackingNumber: "AWB123" });
      expect(shipped.body.data).toMatchObject({ status: "shipped", paymentStatus: "paid", tracking: { carrier: "BlueDart", number: "AWB123" } });
      expect(shipped.body.data.tracking.shippedAt).not.toBeNull();
      expect((await setStatus(o.id, { status: "cancelled" })).status).toBe(409); // shipped can't be cancelled
      const delivered = await setStatus(o.id, { status: "delivered" });
      expect(delivered.body.data.status).toBe("delivered");
      expect(delivered.body.data.deliveredAt).not.toBeNull();
      expect((await setStatus(o.id, { status: "processing" })).status).toBe(409);
    });

    it("admin cannot mark an unpaid order as paid / processing / shipped (payment can't be faked from the status editor)", async () => {
      const cat = await seedShopCategory();
      const p = await seedShopProduct(cat.id);
      const b = await buyer();
      const order = await placeOrder(b.token, b.address.id, [{ productId: p.id, quantity: 1 }]);
      for (const status of ["processing", "shipped", "delivered", "refunded"]) {
        expect((await setStatus(order.body.data.id, { status })).status).toBe(409);
      }
      expect((await setStatus(order.body.data.id, { status: "paid" })).status).toBe(400); // not even an accepted value
      const row = await getDb()("shop_orders").where({ id: order.body.data.id }).first();
      expect(row.payment_status).not.toBe("paid");
    });

    it("cancelling a paid order returns stock once; refund then records the refund without touching stock again", async () => {
      const o = await paidOrder();
      expect(await stockOf(o.p.id)).toBe(3);
      const cancelled = await setStatus(o.id, { status: "cancelled", reason: "Customer asked" });
      expect(cancelled.body.data).toMatchObject({ status: "cancelled", cancelReason: "Customer asked", paymentStatus: "paid" });
      expect(await stockOf(o.p.id)).toBe(5);
      const refunded = await setStatus(o.id, { status: "refunded" });
      expect(refunded.body.data).toMatchObject({ status: "refunded", paymentStatus: "refunded" });
      expect(await stockOf(o.p.id)).toBe(5);
      expect((await setStatus(o.id, { status: "refunded" })).status).toBe(409);
    });

    it("updates tracking details independently of status", async () => {
      const o = await paidOrder();
      const res = await testAgent().patch(`/api/v1/admin/shop/orders/${o.id}/tracking`).set("Authorization", bearer(adminToken)).send({ trackingCarrier: "DTDC", trackingNumber: "X1" });
      expect(res.body.data.tracking).toMatchObject({ carrier: "DTDC", number: "X1" });
      expect(res.body.data.status).toBe("paid");
    });

    it("reports an overview with low-stock and fulfilment counts", async () => {
      await paidOrder();
      const res = await testAgent().get("/api/v1/admin/shop/overview").set("Authorization", bearer(adminToken));
      expect(res.body.data).toMatchObject({ ordersToFulfil: 1, ordersAwaitingPayment: 0 });
    });
  });
});
