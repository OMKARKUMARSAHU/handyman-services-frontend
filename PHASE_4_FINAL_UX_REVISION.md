# PHASE 4 — FINAL HOMEPAGE / UX CORRECTION — REFERENCE-DRIVEN REVISION

**Date:** 2026-09-21
**Scope:** Frontend-only structural UX correction to the homepage, footer, Video Curations, and mobile WhatsApp entry point, driven by 10 client-supplied reference images (live marketplace mobile/desktop screenshots + the official Handyman Services logo). No backend, Admin Panel, authentication, or payment work was started. This is the third and final revision in the Phase 4 QA/correction sequence (Post-QA Revision 1 → Post-QA Revision 2 → this).

This was a genuine **structural correction**, not a CSS-only pass: two components were redesigned around a different data shape (`LargeSpotlightBanner`, `VideoCurationModal`/`VideoCurationGallery`), one component was deleted outright (`StickyMobileCTA`), the footer's link groups were rebuilt, both homepage files were reordered and had two sections removed, and a new reusable content type (`PromotionalBannerContent`) was added to the data contract.

---

## 1. What was removed

- **FAQ section from the homepage** (`/` and `/[city]`). The `/faq` route, `getFAQs()`, and `faqs.json` are completely untouched — anyone who navigates to `/faq` directly still sees the full FAQ list. `FAQAccordion` is still used there. The homepage simply no longer renders a 3-question preview of it.
- **The "Final CTA" section** (`CTASection`, the `finalCta` homepage-section entry) — the client's own words: "giant CTA section" / "unnecessary 'book a service' corporate CTA blocks." Removed from both homepage files. `CTASection.tsx` and the `finalCta` JSON entry are kept, unused, the same way `Testimonials` was kept unused after its own earlier removal — nothing referencing them was deleted, in case a real, non-generic closing CTA is wanted again later.
- **The footer's "Also serving `<cities>`" line** (added just one revision ago in Post-QA Revision 2) — removed entirely. The client's reasoning, backed by the reference footer: location is already chosen once at the top of the site via the location selector, so a footer city list is redundant. `getAllCitiesSync` is no longer imported by `Footer.tsx`; city data itself is untouched and still backs the location selector and every `/[city]` route.
- **The footer's "For Professionals" column** — removed entirely, not just reworded. The client gave an explicit fallback rule for exactly this situation: *"Use only a normal 'Become a Service Provider' link/button if the page exists. If there is no destination yet, remove the item entirely."* No service-provider registration/login route exists anywhere in this frontend (verified against the full route list — provider tooling has been out of scope since Phase 2), so per that rule the column is gone rather than shown as a dead link or another "coming soon" label.
- **Every remaining visible "coming soon" label on the site.** Besides the footer's "For Professionals" column, two other pages had a literal "coming soon" phrase in visible copy:
  - `/about` — "Built and run by a small local team — photo coming soon." → "Built and run by a small local team." (the `ProfileImageSlot` placeholder icon already communicates "no photo yet" visually; the text didn't need to repeat it).
  - `/login` — subheading "Sign-in is coming soon." → "Account sign-in isn't turned on yet." (the page's own body copy already explained this honestly; only the header repeated the flagged phrase).
  - The video modal's own "Video coming soon" placeholder text is the one explicit exception the client's spec keeps — see §3.
- **The old mobile-only `StickyMobileCTA` component** — deleted outright (not just hidden). It rendered a full-width, fixed-to-the-bottom "Chat on WhatsApp" bar, which the client explicitly called unacceptable. See §4.

## 2. What was redesigned

- **Homepage section order** (`app/page.tsx`, `app/[city]/page.tsx`) — reworked to the client's specified order: Hero → Trust strip (compact, real `whyChooseUs` data) → **Large Promotional Banner #1** → New & Noteworthy → Featured Services → Category-wise rails → Browse by Category grid → **Large Promotional Banner #2** → Video Curations ("See It In Action") → Spotlight/Offers (small cards, secondary) → How It Works (compact) → Footer. No FAQ, no Final CTA section anywhere in that order.
- **The large promotional banner** (`LargeSpotlightBanner.tsx`) now appears **twice** per homepage instead of once (item 4 — "use multiple banners at different points in the homepage"), and its second instance opens on a different banner (`startIndex={1}`) so the two don't show identical content before anyone interacts with either.
- **The Video Curations modal** (`VideoCurationModal.tsx`) — rebuilt from a landscape `aspect-video` (16:9) viewer into a large, centered, genuinely **tall/vertical viewer**, matching the reference screenshots' vertical video cards. See §3 for the full behavior.
- **The footer** (`Footer.tsx`) — rebuilt a third time to the client's exact specified structure. See §5.
- **The mobile WhatsApp entry point** — the full-width bottom bar is gone; the existing floating circular button now renders at every breakpoint. See §4.
- **The header and footer brand mark** — the placeholder text-based "HS" square is replaced with the official supplied Handyman Services logo image everywhere the brand mark appears. See §6.

## 3. Video Curations — interaction behavior

**The rail.** Unchanged in its fundamentals (it was already a horizontal `snap-x` slider of large vertical 9:16 cards, not a static grid, going back to Post-QA Revision 2) but with two additions:
- Desktop left/right arrow buttons (`sm:flex`, hidden on touch) now scroll the rail by roughly one card width, giving explicit "left/right navigation where appropriate" on top of the existing swipe/scroll/keyboard-focus interaction.
- On mobile the rail is still swiped directly — verified with Playwright (`scrollWidth > clientWidth` on the rail's scroll container at 390/375/360px).

**The modal — this was the client's core "not sufficient" complaint, now addressed.** Every card is unconditionally clickable — `aria-haspopup="dialog"`, `onClick` opens the modal regardless of whether real media exists — and opens `VideoCurationModal`:

- **Shape:** height-driven sizing (`h-[min(78vh,640px)]` with `aspect-[9/16]` deriving the width from that), not width-driven — the opposite of the old `aspect-video` panel. This is what keeps it a genuinely tall/vertical viewer on both a short mobile viewport and a tall desktop one, verified by Playwright asserting `panel.height > panel.width` at both 1440×900 and 390×844.
- **Media branching**, unchanged in principle from Post-QA Revision 2, still keyed off the same `VideoCuration` fields (`videoUrl`, `externalUrl`, neither): a real `<video>` player, an `<iframe>` embed, or an honest, Handyman-branded "Video coming soon" placeholder with a one-line explanation ("This curation is ready for the Admin Panel to add real footage — nothing fake is shown in its place") — never a fake embed, never a fabricated external URL. All six mock curations hit the placeholder branch today.
- **New:** optional previous/next controls (chevron buttons over the media, `ArrowLeft`/`ArrowRight` keyboard support) and a Stories/Reels-style segmented progress bar across the top when more than one curation exists. Both are genuinely optional — pass no `onPrev`/`onNext` and neither renders; verified with a single-curation scenario isn't in the mock data today, so this was verified structurally (props-optional) rather than against a live single-item case.
- **Accessibility — explicit non-regression requirement, verified, not just carried over:** `role="dialog"` + `aria-modal="true"` + `aria-labelledby`; portal-rendered to `document.body` (escapes the rail's own clipping/overflow context, never mounted during SSR); focus moves to the close button on open; Tab/Shift+Tab is trapped inside the dialog; Escape closes; a backdrop click closes; focus returns to the exact card that opened it; `document.body` scroll is locked while open and restored on close. Verified end-to-end with Playwright (open → assert `role="dialog"` → assert `body.style.overflow === "hidden"` → Escape → assert dialog gone → assert `document.activeElement`'s `aria-label` matches the trigger card → assert body overflow restored) and with axe-core (0 violations with the modal open, both desktop and mobile).
- **Scroll position:** closing the modal never touches the rail's own horizontal scroll offset — the modal is a `fixed`-position portal entirely outside the rail's scrollable container, so there's nothing that could move it. Verified on mobile: scrollY before opening vs. after closing differs by <5px.

## 4. Mobile WhatsApp fix

The old `StickyMobileCTA` component is **deleted**, not hidden — it rendered a `fixed inset-x-0 bottom-0` full-width bar with a "Chat on WhatsApp" button spanning the entire screen width, visible only below `md`. The client's reference diagrams called this out explicitly as the wrong pattern.

`WhatsAppButton`'s existing `floating` variant — small (48×48px), circular, fixed bottom-right — was already exactly the right treatment; it was just previously gated to `hidden md:flex` (desktop-only), with the full-width bar covering mobile instead. That gate is removed: it now renders unconditionally in `layout.tsx` at every breakpoint, and its positioning now uses `env(safe-area-inset-bottom)`/`env(safe-area-inset-right)` so it never sits under a phone's home-indicator/gesture area.

Verified with Playwright at 390/375/360px: exactly one `a[aria-label="Chat on WhatsApp"]` element exists, its bounding box is under 80×80px (never full-width), the old `[aria-label="Quick contact"]` region is gone, and it never overlaps or displaces the footer (footer's own bottom padding was reduced from an asymmetric `pb-20 md:pb-12` — sized for the old bar — to a uniform `pb-16` that just clears the floating button at every breakpoint now that it renders everywhere).

## 5. Footer — third redesign

Structure is now exactly what the client specified:

- **Brand block:** the official logo (see §6) + "Book reliable appliance services at home."
- **Company:** About Us, Contact Us, Privacy Policy, Terms & Conditions (Legal merged in, FAQ dropped).
- **For Customers:** Login, My Orders, Contact Us (Contact Us is deliberately repeated from Company, per the client's own two-group spec — not a data bug).
- **Social:** gated on `ContactInfo.socialLinks` being non-empty — still empty in mock data, so nothing renders (honest omission, not a fake link — unchanged from earlier rounds).
- **Bottom bar:** copyright + Privacy Policy + Terms & Conditions.

Gone: the "Also serving `<cities>`" line, the "For Professionals" column, both "coming soon" list items, and (from two rounds ago) the full per-product/per-service-type catalog columns. Two nav groups instead of three, no long list anywhere — verified against axe-core (0 contrast/landmark violations) and Playwright (`text=Also serving` count 0, `text=For Professionals` count 0, `text=/coming soon/i` count 0 on every scanned route).

## 6. Logo integration

The official Handyman Services logo (`af5e403e-image.jpg` from the client's reference upload — a hardhat mascot circle + "HANDYMAN SERVICES" wordmark on a black background) is saved at `public/images/brand/handyman-logo.jpg` and used in two places, at two different crops, because the two contexts have very different amounts of vertical room:

- **Header:** the sticky top bar is a fixed 64px-tall row — not enough room to show the full mascot+wordmark lockup legibly. The badge shows just the mascot portion via a CSS crop (`object-cover object-top` on the untouched source image, not a separately pre-processed asset), and the real "Handyman Services" text stays live, accessible HTML next to it (unchanged from before). The image's `alt` carries the brand name so the header logo link has a correct accessible name at every viewport, including mobile where the adjacent text span is `hidden` (and now `aria-hidden` to avoid the name being read twice on desktop).
- **Footer:** genuine vertical room, so this shows the logo's full lockup (mascot + wordmark, exactly as supplied) at `h-14 sm:h-16` with `w-auto` — aspect ratio preserved, never stretched or distorted. The separate "Handyman Services" text label is dropped from this block specifically so the name isn't shown twice in one spot.

No other Urban Company (or any other reference site's) branding, logo, imagery, or copy was used anywhere — verified with a full-page-text scan for "Urban Company" (0 matches) in addition to manual review.

## 7. Promotional banner — reusable data shape

The client asked for a reusable banner component with a specific field list: `id, eyebrow, title, subtitle, CTA label, CTA href, image, optional background, optional badge`. A new `PromotionalBannerContent` type (in `src/types/index.ts`) carries exactly that shape, and `LargeSpotlightBanner.tsx` now renders only that generic type — it never reads `Offer` fields directly.

Today the only banner source this mock-data phase has is the active `Offer` list, so a small mapping function (`offersToBanners`) turns each `Offer` into a `PromotionalBannerContent` at render time, rather than introducing a second, parallel "promotional banners" JSON file that could drift out of sync with the real discount it's promoting (there is exactly one place discount data lives: `offers.ts`). A future Admin Panel can add a dedicated banner data source with its own `ctaText`/`ctaLink`/image-per-banner fields — the component itself needs no redesign, only a different array passed in.

CTA destinations are still derived, never fabricated: a `category`-scope offer links to that category's page, a `service`-scope offer resolves through its product to the category, and everything else falls back to `/services` — all real, working routes (spot-checked with curl in earlier rounds; unchanged logic this round).

## 8. Responsive & functional QA

Full production build (`next build`, not dev mode) served locally and driven with Playwright/Chromium. All checks below passed on the **final** build, after two accessibility bugs (§9) were found and fixed mid-pass.

**Breakpoints tested:** Desktop 1440 / 1280 / 1024, Mobile 390 / 375 / 360 — the exact set the client specified.

**56 functional checks, all passing**, covering:
- No FAQ section on either homepage; exactly two "Explore offer" large-banner CTAs per homepage.
- Video curation rail present as a scrollable region (not a static grid) on both homepages.
- Footer has no "Also serving" text, no "For Professionals" column, no visible "coming soon" text, and renders the official logo image; header also renders the official logo image.
- WhatsApp floating button present and small/circular (not a full-width bar) at every breakpoint tested, including desktop.
- Video modal: opens on card click, panel is taller than wide (vertical, not landscape) at both desktop and mobile sizes, shows the honest placeholder, locks/restores body scroll, closes on Escape, returns focus to the trigger card, has a working "next" control that changes the displayed video.
- No horizontal overflow at any tested breakpoint (1440/1280/1024/390/375/360).
- Mobile menu is a bounded drawer (`max-height` + `overflow-y-auto`), not a full page.
- Mobile video rail is horizontally scrollable (swipeable).
- Closing the video modal on mobile preserves scroll position (within 5px).
- No "Urban Company" text anywhere on the page.
- Zero browser console errors across every scenario above.

**Additional checks:** zero failed/4xx/5xx network requests and zero broken `<img>` elements (`naturalWidth === 0`) at 1440/1280/1024.

## 9. Accessibility QA

**35 axe-core scans (`wcag2a`, `wcag2aa`, `best-practice`), 0 violations in the final pass** — 8 routes (`/`, `/ranchi`, `/about`, `/contact`, `/login`, `/faq`, `/cart`, `/services`) × 4 viewports (1440, 1024, 390, 360), plus the video modal open at desktop and mobile, plus the mobile menu open.

Two real issues were caught mid-pass and fixed, not just carried over as "already passing":

1. **`link-name` (serious), mobile only, every route.** The header's logo `<Link>` originally used an empty `alt=""` on the new logo image, relying on the adjacent "Handyman Services" text span for its accessible name — but that span is `hidden` (`display:none`) below the `sm` breakpoint, and hidden text doesn't contribute to a link's accessible name. Below 640px wide, the header's home link had no accessible name at all. Fixed by giving the image a real `alt="Handyman Services"` and marking the redundant text span `aria-hidden="true"` at every breakpoint, so the link has exactly one, always-correct accessible name.
2. **`color-contrast` (serious), mobile menu open only.** `MobileMenu.tsx`'s group headings ("Company", "For Customers") used `text-neutral-400`, which is the established *dark-background* muted shade in this project's palette (it passes on the footer's `bg-neutral-900`) — but the mobile menu panel has a white background, where that same class resolves to ~2.3:1 contrast, failing WCAG AA's 4.5:1. This was a latent bug from before this revision (the component wasn't touched this round) that a broader QA sweep — "mobile menu open" wasn't part of earlier rounds' axe scans — happened to surface. Fixed by switching to `text-neutral-500` (this palette's correct *light-background* muted shade, already used elsewhere for the same purpose).

Both fixes were verified with a full re-run of all 35 scans: 0 violations across the board, including both previously-failing scenarios.

## 10. Build results

```
npx tsc --noEmit     → 0 errors
npm run lint          → 0 errors, 0 warnings (app code)
npm run build          → succeeded, 494 static pages generated, no build warnings
```

(The only ESLint warnings anywhere were inside the temporary `.mjs` Playwright QA scripts used for this pass — never in application code — and those scripts have been deleted from the repository; they were scratch tooling, not part of the deliverable.)

## 11. Known limitations / explicitly out of scope

- No real video footage or photography exists yet for any Video Curation — all six mock curations render the honest placeholder. This is expected; the data model (`videoUrl`, `externalUrl`, `thumbnail`, `title`, `description`, `category`/`serviceType` tags, `durationSeconds`, `sortOrder`, `active`) is ready for an Admin Panel to populate without any further UI change.
- Promotional banners are still sourced from the `Offer` entity (mapped into the generic `PromotionalBannerContent` shape at render time) rather than a dedicated banner data source — see §7 for the reasoning. A future Admin Panel banner table can be swapped in as a drop-in data source.
- No business-scope decisions were touched: multi-city cart handling and `Offer`/`offerPrice` display precedence remain exactly as unresolved as they were before this revision (see `PHASE_2_OPEN_QUESTIONS.md` — items #24 and #25, untouched).
- No backend, database, authentication, payment gateway, or Admin Panel work was started, per the explicit stop rule for this revision.
- No deployment was performed.

---

**Stop rule:** this frontend UX revision and its QA are complete. Per the client's explicit instruction, work stops here pending review and approval before any further phase (backend, Admin Panel, auth, payments, or deployment) begins.
