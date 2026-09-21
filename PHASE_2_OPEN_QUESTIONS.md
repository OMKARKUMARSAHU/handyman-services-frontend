# Phase 2 — Open Questions
## Handyman Services Marketplace

**Status:** Consolidated from `PHASE_1_NEW_REQUIREMENTS_ANALYSIS.md` §43 plus new questions surfaced while designing the six other Phase 2 documents. Nothing here has been decided unilaterally — nothing listed as open has been assumed or built.

---

## 1. Carried forward from Phase 1 (unchanged status)

These were flagged `[TO BE CONFIRMED]` in Phase 1 and remain open — restated here for a single reference point, not re-litigated:

1. Login method — OTP vs. password vs. social
2. Payment gateway choice/integration
3. Exact booking time-slot rules
4. Coupons (as distinct from `Offer`)
5. Wallet
6. Refund and cancellation rules
7. Provider assignment logic
8. Live provider tracking
9. Notifications (email/SMS/push)
10. Ratings/reviews — whether in scope at all
11. Exact Service Provider dashboard feature set
12. Exact Customer account-area feature set (which of Profile/Addresses/Orders/Bookings are must-have vs. later)
13. Final launch cities
14. Final category/product/service catalogue (beyond the client's illustrative examples)
15. Admin authentication method, and whether Admin/Provider areas live inside this frontend app or as separate applications

## 2. New questions surfaced during Phase 2 design

These weren't visible until the architecture/data/UI design work made them concrete decision points. Each names which Phase 2 document it affects and what this document assumed **by default**, pending confirmation, so Phase 3 has somewhere unambiguous to start rather than a blank gap.

| # | Question | Where it surfaced | Default assumed in Phase 2 (pending confirmation) |
|---|---|---|---|
| 16 | Does selecting a city **gate** the site (nothing browsable first) or **scope** it (browsable, refined once picked)? | `PHASE_2_SYSTEM_ARCHITECTURE.md` §4, `PHASE_2_PAGE_STRUCTURE.md` §2 | Scope, not gate (lower-risk default, matches the reference site's general pattern) |
| 17 | Is a cart allowed for a guest (not logged in), or is login required before adding to cart? This decision also determines whether `Order.customerId` is required or nullable — `PHASE_2_DATA_ARCHITECTURE.md` and `PHASE_2_API_CONTRACT.md` are now written consistently, both marking it TBD/nullable-compatible pending this answer, rather than one requiring it and the other not. | `PHASE_2_DATA_ARCHITECTURE.md` §3 (Cart, Order), `PHASE_2_API_CONTRACT.md` §5, `PHASE_2_SYSTEM_ARCHITECTURE.md` §5 | Guest cart allowed (localStorage-based), login required only at checkout — common pattern, not client-confirmed; `Order.customerId` is modeled as nullable/optional until this is confirmed, not as a required field that would imply login is mandatory |
| 18 | Is "Most-Booked Services" a real, order-count-driven ranking, or an Admin-curated list, or omitted at launch? | `PHASE_2_UI_UX_DESIGN.md` §5, `PHASE_2_API_CONTRACT.md` §2 | Left as an explicit open item — no real order-volume data will exist at launch, so this needs a decision, not an assumption |
| 19 | Are reviews/ratings shown anywhere at launch, even as an empty/"no reviews yet" state, or fully hidden until built? | `PHASE_2_UI_UX_DESIGN.md` §7, `PHASE_2_API_CONTRACT.md` | Fully hidden until confirmed — do not show an empty ratings UI that implies a feature exists |
| 20 | Should `Order.scheduledSlot` be a real time-window picker or a simple "morning/afternoon/evening" preference at launch? | `PHASE_2_DATA_ARCHITECTURE.md` §3, `PHASE_2_UI_UX_DESIGN.md` §9 | Simple preference only, until real slot/capacity rules are confirmed |
| 21 | Should the legacy `Plan` (Silver/Gold/Platinum) route (`/plans`) be removed entirely, or kept live but unlinked, during the marketplace build? | `PHASE_2_PAGE_STRUCTURE.md` §1 | Kept live but unlinked from primary navigation/homepage — reversible, loses nothing, matches the client's "LEGACY / PENDING DECISION" instruction exactly |
| 22 | Existing mock lead-submission copy (`src/lib/data/leads.ts`) contains internal-sounding language ("Phase 3 demo submission") in the customer-facing success message. Should this be corrected when the checkout mock is built in Phase 3, even though it predates this re-scope? | `PHASE_2_API_CONTRACT.md` §5 | Not changed now (no code touched in Phase 2); flagged for correction as part of Phase 3 implementation of the new order-confirmation flow |
| 23 | Are service `slug`s required to be globally unique (simpler routing, `PHASE_2_PAGE_STRUCTURE.md` §1), or should they be unique only per product (allows reusing a slug like "installation" across products, at the cost of a longer URL)? | `PHASE_2_PAGE_STRUCTURE.md` §1, `PHASE_2_DATA_ARCHITECTURE.md` §3 | Globally unique `serviceSlug`, simplest routing and matches how the current site's category slugs already work |
| 24 | **Multi-city cart behavior (unresolved business rule):** the architecture allows a cart item to carry its own city context (a `CartItem` references a `Service`, and `Service` availability is city-scoped via `ServiceCityAvailability`). If a customer adds a service while browsing City A, then switches to City B and adds another service, how should checkout resolve the service city? Should one cart be restricted to a single city (adding from a second city warns/replaces/starts a new cart), should checkout split into separate orders per city, or should another rule apply? | `PHASE_2_DATA_ARCHITECTURE.md` §3 (Cart/CartItem), `PHASE_2_SYSTEM_ARCHITECTURE.md` §4–5, `PHASE_2_UI_UX_DESIGN.md` §8, `PHASE_2_PAGE_STRUCTURE.md` §1 | **None — no default assumed.** This is deliberately left unresolved rather than decided unilaterally; must be confirmed before Phase 3 implements cart/checkout |
| 25 | **Offer vs. `Service.offerPrice` precedence (unresolved business rule):** `Service` already carries `mrp`/`offerPrice` with a derived discount, and the separate `Offer` entity carries its own percent/flat discount scoped to services/categories. Does an applicable `Offer` stack with, replace, or otherwise interact with the `offerPrice`-derived discount at display/checkout time? | `PHASE_2_DATA_ARCHITECTURE.md` §3 (Service, Offer), `PHASE_2_UI_UX_DESIGN.md` §7, `PHASE_2_API_CONTRACT.md` §2 | **None — no default assumed.** The client has not confirmed a stacking/precedence rule; Phase 2 does not imply the two discounts combine automatically |

## 3. How to use this document

Each item above is a **decision the client can make at any pace** — none of them block starting Phase 3 implementation of the parts that don't depend on them (e.g., the category/product browsing UI doesn't need the login-method decision). Recommended before Phase 3 kickoff: confirm items 16–18 and 21 specifically, since they change page structure and homepage composition; item 24 (multi-city cart behavior) should also be confirmed before cart/checkout is built, since it changes `Cart`/`Order` data shape and checkout flow rather than just display; item 25 (Offer vs. offerPrice precedence) should be confirmed before any pricing/discount display logic is implemented, to avoid building a stacking behavior that isn't wanted. The remainder (payment, auth method, slots, coupons, wallet, refunds, reviews, provider/admin specifics) can reasonably be confirmed later without blocking initial marketplace-catalog implementation, since Phase 2's architecture was deliberately designed to accommodate a late answer on each (see the relevant `[TBD]` fields in `PHASE_2_DATA_ARCHITECTURE.md`).
