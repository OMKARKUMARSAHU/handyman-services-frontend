# Phase 2 — API Contract (Data Access Layer)
## Handyman Services Marketplace

**Status:** Phase 2 draft, pending client approval. No functions implemented from this document yet.
**Builds on:** `PHASE_2_DATA_ARCHITECTURE.md` (entity shapes), `PHASE_2_SYSTEM_ARCHITECTURE.md` (the Data Access Layer principle).

**What this document is:** not a REST/GraphQL API spec for a server that exists — there is no backend yet, and none is being built in this phase. This is the **contract the frontend's Data Access Layer functions expose to components today** (backed by mock JSON) and **the same contract a future real backend would need to satisfy** to be swapped in without any UI rewrite (Phase 1 §17–18/§26/§39, restated as concrete function signatures rather than a general principle). Every function below follows the existing project's convention (`src/lib/data/*.ts`, e.g. today's `getPlans()`, `getCategoryById()`) — this document extends that exact pattern to the new entities.

---

## 1. Convention

- One module per entity family under `src/lib/data/`, barrel-exported from `src/lib/data/index.ts` — unchanged from today.
- Read functions are named `get<Entity>()` / `get<Entity>ById(id)` / `get<Entities>By<Relation>(...)`, matching existing names like `getCategoryById`, `getAppliancesByCategory`.
- Functions that will eventually be network calls (i.e., everything once a real backend exists) are written as `async` **from the start**, even though the mock implementation can resolve synchronously — this avoids a signature-breaking change later (a small, deliberate deviation from a few of today's synchronous mock functions, made explicit here so Phase 3 applies it consistently to new modules).
- Mutation functions (cart, checkout) mirror the existing `submitLead()` pattern: they validate input, simulate the operation, and return a typed result — no real persistence in Phase 3, per client instruction.

## 2. Catalog reads

```ts
getCities(): Promise<City[]>
getCityBySlug(slug: string): Promise<City | null>
getPopularCities(): Promise<City[]>

getCategories(): Promise<Category[]>
getCategoryBySlug(slug: string): Promise<Category | null>

getProductsByCategory(categoryId: string): Promise<Product[]>
getProductBySlug(categorySlug: string, productSlug: string): Promise<Product | null>

getServiceTypes(): Promise<ServiceType[]>

getServicesByProduct(productId: string, opts?: { cityId?: string; serviceTypeId?: string }): Promise<Service[]>
getServiceBySlug(slug: string, opts?: { cityId?: string }): Promise<Service | null>

getFeaturedServices(cityId?: string): Promise<Service[]>          // homepage "featured/new"
getMostBookedServices(cityId?: string): Promise<Service[]>        // [TBD — requires order data; see PHASE_2_UI_UX_DESIGN.md §5]

getOffers(opts?: { cityId?: string; serviceId?: string; categoryId?: string }): Promise<Offer[]>
```

`cityId`/`cityId?` parameters are how `ServiceCityAvailability` (`PHASE_2_DATA_ARCHITECTURE.md` §3) is applied: passing a city filters out services not available there. Pricing/discount is **not** a separate function — it's computed by the shared `lib/pricing.ts` helper (`PHASE_2_SYSTEM_ARCHITECTURE.md` §7) applied to whatever `Service` records these functions return, so discount logic lives in exactly one place.

**`[TBD]`** This pricing helper computes only the `Service.mrp`/`offerPrice`-derived discount. It does **not** also apply or combine any matching `Offer` (from `getOffers()` above) — whether an `Offer` stacks with, replaces, or otherwise interacts with this figure is unconfirmed (`PHASE_2_DATA_ARCHITECTURE.md` §3, Open Question #25). A component that wants to show an applicable `Offer` today does so as a separate, informational element, not as an input to this pricing calculation.

## 3. Search

```ts
searchCatalog(query: string, opts?: { cityId?: string }): Promise<{
  categories: Category[];
  products: Product[];
  services: Service[];
}>
```

Mock implementation: client-side substring match across category/product/service names, extending the existing `SearchBox` filter logic (today's over just categories/appliances) to the larger entity set, exactly as scoped in `PHASE_2_SYSTEM_ARCHITECTURE.md` §8. A real backend implementation could later add ranking/typo-tolerance behind this same signature without the `SearchBox` component changing.

## 4. Cart

```ts
getCart(): Cart                          // reads from CartProvider/localStorage — not async,
                                          // this one is genuinely local client state, not a
                                          // future network read (see PHASE_2_SYSTEM_ARCHITECTURE.md §5)
addToCart(serviceId: string, quantity?: number): Cart
updateCartItemQuantity(cartItemId: string, quantity: number): Cart
removeFromCart(cartItemId: string): Cart
clearCart(): void
```

These back the `CartProvider` context (`PHASE_2_SYSTEM_ARCHITECTURE.md` §5) rather than the page-level Data Access Layer pattern used elsewhere — cart is genuinely client-local state in Phase 3, not a mock stand-in for a server call, so it is **not** written as `async` (unlike §2/§3) to keep that distinction honest rather than implying a network round-trip that doesn't exist. If/when carts become server-persisted (tied to a logged-in `Customer`), this module's internals change; its call sites (cart drawer, cart page) would not need to.

**`[TBD]`** None of the functions above validate or restrict a `Service`'s city against other items already in the cart — whether they should is the unresolved multi-city cart question (`PHASE_2_DATA_ARCHITECTURE.md` §3, Open Question #24). `createOrder()` below inherits the same open question at checkout time.

## 5. Checkout / Order (mock, mirrors existing `submitLead` pattern)

```ts
createOrder(payload: {
  items: { serviceId: string; quantity: number }[];
  address: Address;
  scheduledDate: string;
  scheduledSlot?: string;              // [TBD — slot rules unconfirmed]
  customerId?: string;                 // [TBD — depends on guest-checkout decision; reconciled
                                        // with Order.customerId (nullable/TBD) in
                                        // PHASE_2_DATA_ARCHITECTURE.md §3, Open Question #17]
}): Promise<{ success: boolean; order?: Order; message: string }>
// [TBD — see PHASE_2_DATA_ARCHITECTURE.md §3 (Cart/CartItem) and Open Question #24: how this
// function should resolve/validate service city when `items` spans more than one city is
// unresolved, not decided here.]

getOrderById(orderId: string): Promise<Order | null>   // for the confirmation page
```

Mirrors `src/lib/data/leads.ts`'s existing mock pattern exactly: validates shape, simulates latency, and — like today's mock lead submission — **must not silently claim a real backend exists**. The mock's returned `message` should be an honest, customer-appropriate confirmation, not exposed development language (the existing `leads.ts` mock message contains internal "Phase 3 demo submission" wording that reads as an internal note rather than customer copy — flagged here as a discrepancy worth fixing when this pattern is extended in Phase 3, not something this document changes today, since no code is being touched in Phase 2). No payment step is included in this function — payment is deliberately out of scope (Phase 1 §18), and its future seam is `Order.paymentStatus` only (`PHASE_2_DATA_ARCHITECTURE.md` §3).

## 6. Auth-dependent functions (signatures reserved, not implemented)

```ts
getCurrentCustomer(): Promise<Customer | null>     // [TBD — depends entirely on login method, Phase 1 §19]
login(credentials: unknown): Promise<...>          // shape intentionally unspecified
logout(): Promise<void>
```

These are listed only to reserve their place in the module structure (`src/lib/data/auth.ts`, not built in Phase 3) — their actual signatures depend on a decision (OTP vs. password vs. social) the client has explicitly not yet made, and specifying parameters now would be inventing that decision.

## 7. Admin-facing writes (not implemented; contract shape only, for Phase-2-readiness)

Per Phase 1 §21/§26/§43, no Admin UI is built now, but the data architecture must be **ready** for it. That readiness means these mutation signatures exist as the target contract, even though nothing calls them yet:

```ts
// City, Category, Product, Service, Offer each get: create / update / setActive
// e.g.:
createService(input: Omit<Service, "id" | "discountPercent" | "discountAmount">): Promise<Service>
updateService(id: string, patch: Partial<Service>): Promise<Service>
setServiceCityAvailability(serviceId: string, cityId: string, active: boolean): Promise<void>
```

This is a **shape reservation, not a Phase 3 deliverable** — it exists so Phase 2's "admin-extensible" requirement (Phase 1 §3 approval) is demonstrably designed for, without committing to building an Admin UI now.

## 8. What "swapping the backend" means under this contract

Today (mock): every function above resolves from `src/data/*.json`. Tomorrow (real backend): the same function bodies call `fetch()` against a REST endpoint, WordPress/WooCommerce, or a custom API — same names, same parameters, same return shapes. No page or component that calls `getServicesByProduct(...)` needs to change. This is the concrete mechanism behind Phase 1's repeated "no UI rewrite" requirement (§17–18, §25–26, §39), made specific rather than left as a principle.
