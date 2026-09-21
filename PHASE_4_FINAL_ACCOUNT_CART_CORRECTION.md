# PHASE 4 — FINAL ACCOUNT/CART CORRECTION — MOBILE ACCOUNT / HAMBURGER / CART

**Date:** 2026-09-21
**Scope:** A focused correction pass after the "FINAL HOMEPAGE / UX CORRECTION" revision. Frontend-only: mobile header/account UX, the hamburger drawer, the Login/Profile page, and cart item removal. No backend, Admin Panel, authentication, or payment work was started; no homepage or footer redesign was touched.

---

## 1. What was inspected before changing anything

Per the client's own instruction to read the existing implementation first, before any edit: `Header.tsx`, `MobileMenu.tsx`, `Footer.tsx`, `AccountButton.tsx`, `AccountShell.tsx`, the three `/account*` pages, `/login`, `/cart`, `CartDrawer.tsx`, `CartLineItem.tsx`, `CartSummary.tsx`, `CartButton.tsx`, `CartProvider.tsx`, `nav.json`/`nav.ts`, and `PHASE_4_FINAL_UX_REVISION.md`.

That inspection changed the shape of this pass in one important way: **the cart's remove/quantity/badge/empty-state logic was already fully wired to a single central `CartProvider` state** — `removeFromCart`, `updateCartItemQuantity` (which removes the item outright at quantity ≤ 0, never leaves a ghost `quantity: 0` row), and a memoized `itemCount`/`subtotal` that both the header badge and every cart surface (drawer, `/cart` page, checkout) read from the same `useCart()` hook. Nothing was duplicating cart state locally. So this pass did not need to build a `removeItem()`/`updateQuantity()` architecture from scratch — it already existed and was already correct — but it did need to verify that empirically (see §4) rather than assume it from a read-through, given how firmly the client's brief stated the remove flow was broken.

## 2. Mobile header — account icon removed

`Header.tsx`'s icon cluster was `[CartButton] [AccountButton] [MobileMenu]`, with only `MobileMenu` itself internally gated to `md:hidden`. Below `md`, all three rendered, including the standalone person/account icon the client called out.

Fixed by wrapping `AccountButton` in `<div className="hidden md:block">`. Desktop (`md:` and up) is completely unchanged — same icon, same `/login` destination, same position. Below `md`, only `[Logo] [Cart] [Hamburger]` render, exactly as specified. (The wrapper hides via a parent `display:none`, not a class appended to `AccountButton` itself, so there's no risk of `hidden` and `AccountButton`'s own `flex` class fighting for the same CSS property on one element.)

## 3. Hamburger — rebuilt as primary navigation, not a footer copy

**Before:** `MobileMenu.tsx` read the same three nav arrays the footer renders — `getFooterCompanyNav()`, `getFooterCustomerNav()`, `getFooterLegalNav()` — grouped under "Company" / "Customer" / "Legal" headings: About Us, Contact Us, FAQ / Login, My Account, My Orders, Addresses, Cart / Privacy Policy, Terms & Conditions. Nine links, three headed groups — a near-exact reproduction of the footer inside a drawer, which is precisely what the client flagged.

**After:** a single flat list of seven real routes, no groups, no headings:

```
Home         /
Services     /services
My Orders    /account/orders
Login        /login
About Us     /about
Contact Us   /contact
FAQ          /faq
```

Every route was verified to exist in the app (`find src/app -name page.tsx`) before use — nothing invented. Cart is deliberately absent (it already has its own always-visible header icon + badge — listing it again would be the same duplication this pass removes). Addresses, Privacy Policy, Terms & Conditions, and "My Account" stay footer/legal-only, per the client's own "keep these concepts separate" rule (§24 of the brief). `nav.ts`'s doc comment was updated to record that the hamburger no longer reads the footer nav functions — they now back only `Footer.tsx`.

## 4. Login/Profile — simplified to a pre-authentication screen

**`AccountShell.tsx` (the 3-tab Profile/Orders/Addresses side nav used by all three `/account*` pages) is deleted outright**, not just restyled. Its sibling-tab chrome was the "fake logged-in dashboard" shape the client's brief explicitly bans (its own "Do NOT show" list — My Account, Addresses, Orders dashboard, Saved addresses — maps almost one-to-one onto that shell's three tabs).

Replaced with a new shared component, `AccountPreAuth.tsx`: one card — a person icon, one honest sentence, one "Log in or sign up" button. Used by:

- **`/login`** — heading "Login", subheading "Account sign-in isn't turned on yet." (unchanged, already honest and already close to the client's own suggested copy), then the `AccountPreAuth` card with the login-method-still-TBD explanation. The **"Call us" and "Chat on WhatsApp" buttons are removed entirely** — those belong to the global floating WhatsApp button (present on every page, including this one, and verified still present), not duplicated on an account-access screen. Since this page *is* the destination, its button renders as a plain, keyboard-focusable `<button>` with no handler — an honest placeholder for a login flow that isn't built, never a fake success state.
- **`/account`** — heading changed from "My Account" to **"Profile"** (the client's own literal suggested heading for this screen), body: "You're not logged in yet — account sign-in hasn't been built.", button links to `/login` (the site's one real account entry point).
- **`/account/orders`** — heading fixed to **"My Orders"** (it previously said "My Account", a pre-existing mismatch with its own `<title>` metadata — corrected while touching this file), contextual message ("Log in to view your order history. If you just placed a booking, use the confirmation link from that order instead."), button to `/login`. This is the page the hamburger's "My Orders" item now points at.
- **`/account/addresses`** — heading fixed to **"My Addresses"** (same pre-existing mismatch, same fix), contextual message, button to `/login`.

No fake OTP/password form, no fake user data, no fake logged-in state anywhere — every one of these four screens states plainly that sign-in isn't built yet.

## 5. Cart — critical functional fix

**Finding:** reading the code, the remove/quantity/badge/empty-state wiring already looked complete and centrally sourced (see §1). Given the client's brief called this "a serious cart UX problem" in strong terms, this pass did not take that read-through at face value — it stood up a production build, ran it, and drove the actual browser through the full add → view → remove → verify lifecycle with Playwright rather than trusting the source alone. That is what actually caught the one real defect in this area (below).

**What already worked, confirmed empirically:**
- Add to cart → header badge updates immediately, no refresh.
- Cart drawer (opened from the header) and the full `/cart` page both show the same item(s) from the same `useCart()` source of truth.
- Every line item has quantity −/+ controls and a "Remove" action.
- Decreasing quantity to 0 removes the item outright — it never leaves a ghost row at `quantity: 0`.
- Removing the only item shows the proper empty-cart state (drawer and `/cart` page each have their own honest "cart is empty" + "Browse services" link, pointing at real routes).
- Removing one of two items updates the subtotal and leaves the other item and its total correct.
- All of the above verified at both mobile (390/375/360) and desktop (1024/1280/1440) — badge, remove, empty state, no horizontal overflow.

**The one real defect found and fixed:** the "Remove" button in `CartLineItem.tsx` was a bare text link (`text-xs`, no padding) — its rendered tap target measured **16px tall** on a real page, well under a usable mobile tap size, and clearly the kind of thing that reads as "there's no obvious way to remove it" on a touchscreen even though the click handler itself was correct. Fixed by giving it proper button padding (`px-2.5 py-1.5`, matching the quantity buttons' visual weight) and a small trash/X icon alongside the label — verified tap target now measures **28px tall** at 390/375/360px. Each Remove button also now gets a distinct `aria-label` ("Remove {service name} from cart") instead of a bare repeated "Remove" string, so multiple cart rows don't share one ambiguous accessible name.

No change was made to `CartProvider.tsx`'s data layer — `removeFromCart`, `updateCartItemQuantity`, and the derived `itemCount`/`subtotal`/`cityIdsInCart` were already correct, already the single source of truth for the header badge, both cart surfaces, and checkout, and needed no `removeItem()`/`updateQuantity()` to be added since they already existed under those exact names.

## 6. Footer

Untouched, as instructed. No columns, city lists, or "For Professionals" restored.

## 7. Functional & responsive QA

Full production build (`next build`, not dev mode) served locally and driven with Playwright/Chromium.

**41 targeted functional checks, all passing**, covering:
- Standalone Account icon absent (not just present-but-hidden — verified via computed visibility) below `md`; still visible and functional at desktop widths.
- Hamburger shows exactly the 7 flat primary-nav items, no Company/Customer/Legal groups, no Addresses/Privacy/Terms/Cart/My Account items.
- Hamburger → Login opens `/login`; login page has no "Call us" text, no "Chat on WhatsApp" text, has one keyboard-focusable "Log in or sign up" button, and the global floating WhatsApp button is still present.
- `/account`, `/account/orders`, `/account/addresses` show the correct headings ("Profile" / "My Orders" / "My Addresses") and a "Log in or sign up" link — no leftover tab bar.
- Full cart lifecycle: add → badge shows 1 → open drawer → item present → Remove → drawer shows empty state → badge disappears. Repeated on the `/cart` page with two items: add both, increase quantity (subtotal changes), remove one (one remains, total correct), remove the last (empty state, "Browse services" link to a real route). Decreasing quantity from 1 removes the item outright (no ghost row).
- Mobile cart at 390/375/360px: no horizontal overflow, Remove button visible with an adequate tap target.
- Zero console errors across every route/state exercised above.

**Regression sweep — 141 checks, all passing** — the required route × breakpoint matrix (`/ranchi`, `/login`, `/cart`, `/services`, `/about`, `/contact`, `/faq` × 390/375/360/1024/1280/1440): no horizontal overflow, no console errors, no failed (4xx/5xx) network requests, at every one of the 42 combinations.

*(Mid-QA process note: the very first run of this regression sweep produced spurious results — a stale `next-server` process from an earlier build had been left running and was still bound to the QA port, silently serving an old build behind a fresh one that failed to start with `EADDRINUSE`. The mismatch was caught because a CSS chunk 404'd against the stale build, tracked down via `/proc/*/cmdline` since the process didn't match a `pkill -f "next start"` pattern, killed directly by PID, and the suite re-run clean against a verified single, current server. Documented here because it's a real process-hygiene lesson for this environment, not because it affected the shipped code.)*

## 8. Accessibility QA

**axe-core (`wcag2a`, `wcag2aa`, `best-practice`), 0 serious/critical violations** across: `/ranchi`, `/login`, `/cart`, `/account`, `/account/orders`, `/account/addresses` at both 1440px and 390px (12 scans), plus three interaction-state scans — hamburger open (390px), cart drawer open with an item (1440px), and `/cart` with an item (390px). 15 scans total, all clean.

Specifically verified: the hamburger button and its close state have accessible names; the header cart button and each cart Remove/quantity button have distinct accessible names; the header logo link's accessible name (fixed in the prior revision) is unaffected by this pass's changes; the "Log in or sign up" control is a real, keyboard-reachable interactive element (a `<Link>` where it navigates, a real `<button>` where it doesn't) at every one of its four locations; Escape still closes the hamburger and the cart drawer; no duplicate/ambiguous interactive controls were introduced.

## 9. Build results

```
npx tsc --noEmit     → 0 errors
npm run lint          → 0 errors, 0 warnings (app code)
npm run build          → succeeded, 494 static pages generated, no build warnings
```

## 10. Files changed

**Created:**
- `src/components/account/AccountPreAuth.tsx`

**Deleted:**
- `src/components/account/AccountShell.tsx`

**Edited:**
- `src/components/layout/Header.tsx` — account icon hidden below `md`.
- `src/components/layout/MobileMenu.tsx` — full rewrite: flat 7-item primary nav, no footer-group reuse.
- `src/lib/data/nav.ts` — doc comment updated (footer-only now).
- `src/app/login/page.tsx` — rewrite: `AccountPreAuth` card, Call us/WhatsApp block removed.
- `src/app/account/page.tsx` — rewrite: heading → "Profile", `AccountPreAuth` card.
- `src/app/account/orders/page.tsx` — rewrite: heading fixed to "My Orders", `AccountPreAuth` card.
- `src/app/account/addresses/page.tsx` — rewrite: heading fixed to "My Addresses", `AccountPreAuth` card.
- `src/components/cart/CartLineItem.tsx` — Remove button: adequate tap target, icon, per-item `aria-label`.

**Not touched:** `CartProvider.tsx`, `CartDrawer.tsx`, `CartSummary.tsx`, `CartButton.tsx`, `Footer.tsx`, the homepage, and every other route — none of this pass's scope required changing them, and none were changed.

## 11. Known limitations / explicitly out of scope

- No real authentication, OTP/password flow, or fake login success was added anywhere — every account touchpoint still honestly states sign-in isn't built.
- `/account` and `/account/addresses` remain reachable only by direct URL (nothing in the primary nav, hamburger, or footer links to them) — matching the client's own specified hamburger/footer content, which names only "My Orders" and "Login" from the account area.
- No business-scope, pricing, city-availability, or multi-city cart decisions were touched.
- No backend, database, authentication, payment gateway, or Admin Panel work was started, per the explicit stop rule for this pass.
- No deployment was performed.

---

**Stop rule:** this account/cart correction pass and its QA are complete. Per the client's explicit instruction, work stops here pending review and approval before any further phase (backend, Admin Panel, auth, payments, or deployment) begins.
