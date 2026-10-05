# Phase: Cart Item Remove / Delete Functionality

Local frontend UX correction only, for client review. **No git add/commit/push, no Vercel deploy** — this phase stops after implementation and QA, per the brief's own explicit stop rule.

## 1. Why this was done

**Client requirement:** a customer must be able to remove an item from the cart at any time — adding an item does not mean committing to buy it — and the Remove action must be obvious, never hidden in a menu, in both the cart drawer and the full `/cart` page, with cart state (badge, item count, subtotal) updating immediately and correctly, without a page reload.

## 2. What the audit found: this was already substantially implemented

Before writing anything, I read the existing cart architecture end to end (`CartProvider.tsx`, `CartLineItem.tsx`, `CartDrawer.tsx`, `CartSummary.tsx`, `CartButton.tsx`, `/cart/page.tsx`). Nearly every requirement in the brief was already correctly built:

- **Central state, single source of truth.** `src/lib/state/CartProvider.tsx` already exposes `addToCart`, `updateCartItemQuantity`, `removeFromCart`, `clearCart` (the same actions the brief asks for, under equivalent names) and persists to `localStorage`. Both the drawer and `/cart` read the exact same `useCart()` context — no separate local cart state anywhere.
- **Remove is a real, always-visible `<button>`** on every cart item, in both the drawer (`CartDrawer.tsx` → `CartLineItem.tsx`) and the full `/cart` page (`/cart/page.tsx` → the same `CartLineItem.tsx`) — one component, two places it's rendered, so there was never a risk of the two surfaces drifting apart.
- **Removing an item updates everything immediately**: it's a plain `setCart` filter on that one item's id, and `itemCount`/`subtotal`/`cityIdsInCart` are all `useMemo`s derived from `cart.items` — so the header badge, the drawer, and the `/cart` page all re-render from the same state change with no page reload and no navigation.
- **Quantity behavior already matched the spec exactly**: `updateCartItemQuantity` already filters an item out once its quantity drops to `<= 0`, so clicking "−" at quantity 1 already removed the item, and quantity > 1 already only decremented. The explicit Remove button was already present at every quantity, not just 1.
- **Empty-cart state already existed** in both the drawer and `/cart` ("Your cart is currently empty." + a "Browse services" link), and the subtotal/checkout block was already conditionally rendered only when `cart.items.length > 0` — so there was no stale-total risk once the cart empties.
- **Accessibility was already close to spec**: a real `<button>`, an accessible name of the form `"Remove {service name} from cart"`, and a visible text label ("Remove") next to the icon — so the icon was never the sole accessible name.
- The "service no longer available" edge case (an item whose underlying mock service was removed from the catalog) already had its own working Remove button too.

Given this, the phase's real job was to verify all of it thoroughly against the brief's exact QA checklist, and fix the two genuine gaps found.

## 3. What was actually changed

**`src/components/cart/CartLineItem.tsx`**
- Added `focus-visible:outline focus-visible:outline-2 ... focus-visible:outline-{red|brand}-500` to the Remove button and both quantity buttons (in both the normal item branch and the "service no longer available" fallback branch). These buttons were already keyboard-focusable and activatable (native `<button>`s), but had no explicit visible-focus styling of their own, unlike the rest of the codebase's established convention on every other interactive control. This is a small, targeted a11y polish, not a functional change.
- Swapped the Remove button's icon from the generic `"x"` (close) icon to a dedicated `"trash"` icon — the brief's own suggested affordance ("Optional trash/delete icon using the existing project icon system") — while keeping the same visible "Remove" text label alongside it, so the accessible name and the icon-plus-text pattern are unchanged.
- Added a short doc comment explaining the component's role in this phase.

I also tried, then reverted, one change: making the "−" quantity button's `aria-label` say `"Remove {name} from cart"` when quantity is 1 (since clicking it at that point does remove the item). On reflection this was a regression, not an improvement — it gave two different buttons in the same cart item the same accessible name ("Remove X from cart"), which is confusing for a keyboard/screen-reader user (two controls that sound identical but sit in different places and behave differently at other quantities). Reverted back to `"Decrease quantity of {name}"` always; the dedicated Remove button remains the one, unambiguous way to remove an item, exactly as the brief specifies ("The explicit 'Remove' action must always remain available").

**`src/lib/icons.tsx`**
- Registered a new `"trash"` icon key (`Trash2` from the already-used `lucide-react` icon set — no new dependency), used only by the Remove button above.

**No other files were changed.** `CartProvider.tsx`, `CartDrawer.tsx`, `CartSummary.tsx`, `CartButton.tsx`, and `/cart/page.tsx` needed no changes — they already satisfied the brief as written.

## 4. Remove functionality

- Cart drawer and `/cart` page: every item has a real `<button aria-label="Remove {service name} from cart">` with a trash icon + visible "Remove" text, never hidden in a menu.
- Clicking Remove filters exactly that one item out of the central cart state; no other item is touched, no page reload, no navigation away from the current surface.
- Verified working identically in the "service no longer available" fallback state.

## 5. Quantity behavior

- Quantity 1, click "−": item is removed (via `CartProvider`'s existing `quantity <= 0` → filter-out logic).
- Quantity > 1, click "−": quantity decreases by 1 only; item stays.
- Click "+": quantity increases by 1, using the existing pricing (`unitPriceAtAdd`) — no pricing/business-rule changes.
- The dedicated Remove button remains present and clickable at every quantity, independent of the quantity controls.

## 6. Empty-cart behavior

- Removing the last item (via Remove, or via "−" at quantity 1) immediately shows the existing empty-cart state — "Your cart is currently empty." + "Browse services" — in both the drawer and `/cart`.
- The header cart badge disappears once `itemCount` reaches 0 (it's only rendered when `itemCount > 0`).
- The subtotal/checkout block disappears along with it (conditionally rendered on `cart.items.length > 0`), so there is no stale total left on screen.

## 7. Drawer behavior

- Verified the drawer's Remove action never overlaps the item image, title, price, or quantity controls at any tested width (1440 down to 360) — the existing layout (image in its own fixed column, Remove sharing a row with the quantity control inside the flexible text column) had enough room even at the narrowest drawer width (the drawer is `w-full` below `max-w-md`, so at 360px viewport width the drawer itself is 360px wide).
- A removal in the drawer is immediately reflected in the full cart state, the header badge, and (confirmed by re-opening) the `/cart` page — all three read the one `CartProvider`.

## 8. Full cart page behavior

- Identical Remove/quantity/empty-cart behavior to the drawer, using the same `CartLineItem` component.
- Subtotal recalculates immediately when an item is removed, confirmed by comparing the rendered subtotal text before and after removal in QA (not just checking it "looks different" — asserted it actually changed and reflects the remaining item's price).
- A removal made on `/cart` is immediately reflected in the header badge and the drawer (confirmed by re-opening the drawer afterward) — same single source of truth.

## 9. QA

A Playwright script ran the brief's exact test plan — both surfaces (drawer, `/cart`), all three scenarios (single add/remove, two-item remove-one/keep-other/subtotal-recalc, quantity decrement-to-removal), at all 6 required widths (1440, 1280, 1024, 390, 375, 360) — plus axe-core, console-error, and page-overflow checks on both surfaces at every width.

**Result: 276/276 checks passed, 0 failures**, after fixing one real product issue and one QA-script issue found during the run:

- **Real product fix**: see §3 above — reverted the "−" button's aria-label overload, which (besides being a genuine accessibility ambiguity) was also what caused my first QA pass's remove-button selector to match two elements per cart item.
- **QA-script fix**: the script's final overflow/axe check block for the "drawer" surface added two items and never removed them (by design, just to have content on screen to scan) — but it shared a browser context (and therefore `localStorage`) with the next surface's tests, so the `/cart`-page tests started with those two leftover items still in the cart. Fixed by giving each surface (drawer, page) its own isolated browser context per width, so every surface's test run starts from a genuinely empty cart rather than depending on the previous surface's tests happening to clean up after themselves.

Specific checks covered, per the brief:
1. Add one service → badge = 1 → open surface → Remove visible → click Remove → item disappears → badge → 0 → empty state appears.
2. Add two different services → remove only the first → second item remains → subtotal recalculates (asserted as an actual value change, not just presence) → remove the final item → empty state.
3. Add one item, increase to quantity 2 → click "−" → quantity becomes 1, dedicated Remove button still present → click "−" again → item removed → empty state.
4. No page-level horizontal overflow at any width (1440 down to 360) on either surface.
5. Zero console errors, zero failed/4xx/5xx network requests.
6. axe-core (`wcag2a`, `wcag2aa`, `best-practice`) = 0 violations on both surfaces at every width.
7. No stale subtotal or stale badge at any point (asserted directly, not just visually).
8. No duplicate cart state — confirmed structurally (drawer and `/cart` both read the one `CartProvider`) and behaviorally (a removal on one surface is reflected on the other).

## 10. Build/lint/type-check

- `npx tsc --noEmit` — clean, 0 errors.
- `npm run lint` — clean, 0 errors, 0 warnings.
- `npm run build` — clean production build, all 494 static/SSG pages generated successfully.

## 11. Scope discipline

Per the brief, this phase did not touch: service prices, the catalog, categories, city availability, checkout business rules, payment, authentication, the backend, the admin panel, the provider panel, header design, footer design, or the horizontal rail arrow-navigation work from the previous phase. No `git add`/`commit`/`push` and no Vercel deploy were performed.
