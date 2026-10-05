# Phase: Cart Remove Button — Checkout / Cart Drawer Visibility Fix

Local frontend UX correction only, for client review. **No git add/commit/push, no Vercel deploy** — this phase stops after implementation and QA, per the brief's own explicit stop rule. This is a correction to the already-approved Cart Remove phase (`PHASE_CART_ITEM_REMOVE.md`) — the Remove functionality itself was not redesigned, only made genuinely reachable in the rendered drawer.

## 1. Root cause

The cart drawer (`src/components/cart/CartDrawer.tsx`) is opened from `CartButton`, which is rendered inside `<Header>`. `Header`'s own element has `backdrop-blur` (`className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur"`), which compiles to CSS `backdrop-filter: blur(8px)`.

Per the CSS spec, an ancestor with a `filter` or `backdrop-filter` value other than `none` establishes a new **containing block** for any `position: fixed` descendant — the same rule that a `transform` or `perspective` ancestor triggers. Because the drawer was rendered inline as a DOM descendant of `<header>` (via `CartButton`), its `fixed inset-0` overlay was sizing and positioning itself against the header's own box — a ~64–120px-tall sticky bar at the top of the page — instead of against the actual viewport.

Concretely, on a 390px-wide viewport, the drawer's "Your cart" panel was rendering at `{ height: 119px }` instead of the full `844px` viewport height. The header row and a sliver of the first cart item still showed inside that shrunken box; the rest of the cart item (price, quantity, and the Remove button), plus in some cases even the subtotal/checkout footer, rendered *outside* that box and bled visually into the page content below — not clipped by any `overflow: hidden` (there isn't one), just badly mispositioned, exactly matching the reported screenshot.

**This was not checkout-specific** — it reproduced identically on every page (home, a service page, `/checkout`) because it depends only on the drawer being a DOM descendant of the `backdrop-blur` header, not on anything about the page it's opened from. `/checkout` is simply where it was noticed and screenshotted.

**Why the previous Cart Remove phase's QA (276/276 "passed") missed this:** that QA suite verified the Remove button was attached, non-zero-sized, and clickable — all true even in the broken layout, because Playwright can still click an element that exists and isn't covered, even if it's rendered outside its intended visual container. It never checked whether the button's rendered position was actually *inside* the drawer panel it's supposed to belong to. This phase's QA (§6 below) adds that check.

## 2. Files changed

**`src/components/cart/CartDrawer.tsx`** — the only file changed.
- Portals the drawer's entire overlay (`fixed inset-0` backdrop + the "Your cart" panel) to `document.body` via `react-dom`'s `createPortal`, instead of letting it render inline wherever `CartButton` happens to sit.
- Added a `mounted` state (set in a `useEffect`, same one-time pattern `CartProvider` already uses for its own hydration) so the portal target (`document.body`) is only read client-side, never during SSR.
- `CartButton` (the header icon + badge) is untouched — it still lives exactly where it was in `Header`. Only the drawer's own rendered output moves in the DOM tree; nothing about the trigger, the badge, or where the drawer visually slides in from changed.

**No other files changed.** `CartLineItem.tsx`, `CartSummary.tsx`, `CartButton.tsx`, `Header.tsx`, `/cart/page.tsx`, and `/checkout/page.tsx` needed no changes — the drawer's own internal layout (header / scrollable item list / footer) was already structured correctly; the only problem was where in the DOM it mounted.

## 3. The exact layout fix

Before: `CartButton` → `<CartDrawer>` rendered inline, nested inside `<header class="... backdrop-blur">`.

After: `CartButton` still renders `<CartDrawer open={open} onClose={...} />` in the same place in the component tree (so `open` state and the click trigger are unchanged), but `CartDrawer` itself now does:

```tsx
if (!open || !mounted) return null;
return createPortal(
  <div className="fixed inset-0 z-50 flex justify-end bg-neutral-900/40" role="presentation" ...>
    ...same drawer markup as before, unchanged...
  </div>,
  document.body
);
```

With the overlay now a direct child of `<body>`, it is no longer inside any ancestor with `backdrop-filter`, `filter`, `transform`, or `perspective` — `position: fixed; inset: 0` resolves against the real viewport again, and the drawer's own already-correct internal structure (fixed header → `flex-1 overflow-y-auto` scrollable item list → normal-flow footer) does the rest: the footer is a plain flex child *after* the scrollable list, never a sticky/fixed overlay on top of it, so it was already structurally guaranteed not to cover items once the outer sizing was fixed.

## 4. Checkout drawer verification

Reproduced the exact reported scenario: added a service, navigated to `/checkout`, opened the cart drawer. Confirmed all of the following, before and after the fix, to document the before/after:

| Check | Before | After |
|---|---|---|
| Item image visible | clipped/mispositioned | ✅ visible |
| Service name visible | clipped/mispositioned | ✅ visible |
| Price visible | clipped/mispositioned | ✅ visible |
| Quantity controls visible | clipped/mispositioned | ✅ visible |
| Remove button visible & within the drawer panel | ❌ rendered outside the 119px-tall panel | ✅ inside the full-height panel |
| Remove button clickable | technically yes (misleading) | ✅ yes, genuinely reachable |
| Subtotal visible | visible but panel itself broken | ✅ visible |
| Proceed to Checkout visible | visible but panel itself broken | ✅ visible |
| Clicking Remove → item disappears, badge/subtotal update, empty state, no reload/navigation | worked functionally despite the broken layout | ✅ confirmed, same behavior, now in a correctly laid-out drawer |

## 5. Entry points tested

Per the brief's explicit requirement, the drawer was opened and audited from all listed entry points, not just checkout:
1. Home page
2. A service page
3. `/checkout`

All three use the exact same `CartDrawer` component (via the same `CartButton` in `Header`), so — as expected — the bug reproduced identically on all three before the fix, and the fix resolved it identically on all three after.

## 6. QA

A Playwright script audited the drawer across all 3 entry points × all 6 required widths (1440, 1280, 1024, 390, 375, 360) = 18 combinations, each covering:

- Single item: drawer opens, Remove button (and quantity controls) genuinely reachable — verified two ways, not just Playwright's `isVisible()`: (a) the button's bounding box is fully contained within the drawer dialog's own bounding box, and (b) `document.elementFromPoint()` at the button's center actually resolves to that button (or a descendant of it), confirming nothing else is occluding that screen position and it isn't rendered outside its container.
- Multiple items (3): vertical scroll only (explicitly checked the item list has no horizontal overflow), every item's Remove button individually verified reachable, subtotal/footer confirmed not overlapping any item's Remove button.
- Remove first item → 2 remain; remove (new) first/"middle" item → 1 remains; remove last item → empty state.
- Empty-cart state appears; header badge returns to "Cart" (no count); subtotal removed from the drawer.
- No drawer-level or page-level horizontal overflow; axe-core (`wcag2a`, `wcag2aa`, `best-practice`) = 0 violations; zero console errors; zero failed/4xx/5xx requests.

**Result: 717/720 checks passed.**

The 3 failures were all `[390px/375px/360px checkout] no page-level horizontal overflow` — and this is **not** the cart drawer bug. Investigated separately: reproducible on `/checkout` with the drawer *closed*, at a fixed `document.documentElement.scrollWidth` of 408px regardless of viewport width (390/375/360 all show the same 408px). Traced to an `<li class="flex items-center gap-2">` element inside `CheckoutStepper` (the "1 Address · 2 Schedule · 3 Summary" step indicator) that doesn't wrap/shrink at narrow widths. This is a **pre-existing bug in the checkout page's own stepper component, unrelated to the cart drawer and unrelated to this fix** — confirmed it isn't caused by the `CartDrawer` change (reproduces with the drawer never opened) and predates this phase. Per the brief's own scope control ("Do NOT change: ... checkout business rules... Only fix the actual CartDrawer layout/visibility problem"), **this was left untouched** and is reported here rather than fixed, pending separate approval.

## 7. Build/lint/type-check

- `npx tsc --noEmit` — clean, 0 errors.
- `npm run lint` — clean, 0 errors, 0 warnings.
- `npm run build` — clean production build, all 494 static/SSG pages generated successfully.

## 8. Scope discipline

Only `CartDrawer.tsx` was changed. Not touched: pricing, catalog, checkout business rules, payment, authentication, backend, admin panel, provider panel, header design (the header's own markup/styling is unchanged — only what's portaled out of it changed), footer, homepage, or the horizontal rail navigation. The pre-existing `/checkout` stepper overflow found during QA (§6) was deliberately left unfixed, as it falls outside this phase's explicit scope. No `git add`/`commit`/`push` and no Vercel deploy were performed.
