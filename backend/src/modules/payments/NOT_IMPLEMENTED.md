# `payments` module — intentionally minimal

The Phase 3 brief is explicit: no payment gateway has been selected yet
(`PAYMENT_GATEWAY_PROVIDER` is `TBD / CLIENT CONFIRMATION REQUIRED` — see
`.env.example`), and the backend must **never fake a successful payment**.

What exists today:

- A generic, gateway-agnostic `payments` table
  (`src/database/migrations/20260101000009_create_payments.ts`): `order_id`,
  `amount`, `status` (`initiated`/`succeeded`/`failed`/`refunded`),
  `provider` (nullable), `provider_reference`, `idempotency_key`. No
  gateway-specific column (card data, UPI VPA, webhook payload shape,
  etc.) exists, on purpose — that would mean guessing a provider Phase 3
  was never told to pick.
- Every order created by `POST /customer/orders`
  (`src/modules/orders/orders.service.ts`) is inserted with
  `payment_status = "not_applicable"` — accurate today, and a value a real
  gateway integration can update once one exists, rather than a
  placeholder that implies payment already happened.

What is deliberately NOT built: no `/payments/*` routes, no webhook
handler, no client SDK integration. Building any of that now would mean
inventing a provider and a request/response shape the brief never
specified — exactly the kind of unconfirmed detail Phase 3 is supposed to
flag rather than assume. See `PHASE_3_BACKEND_IMPLEMENTATION.md` §17.
