# Phase 4 — Post-QA Revision 2

**Date:** 2026-09-21
**Scope:** A focused homepage marketplace visual rework after live review — Video Curations redesigned with a real popup player, a new large Spotlight/promotional banner system, a homepage information-architecture pass, and a second, denser footer simplification — plus full non-regression QA.

This document is an addendum to `PHASE_4_TEST_REPORT.md` and `PHASE_4_POST_QA_REVISION.md`, not a replacement for either. The QA-approved application from those two rounds was not rejected or rebuilt — this is a further iteration on top of it. Nothing here resolves any open business decision (multi-city cart, Offer/offerPrice precedence, login method, payment gateway, booking rules, coupons/wallet/refunds, provider assignment/tracking, launch cities, final catalogue/pricing, or Admin/Provider dashboard scope), and no backend, database, authentication, payment, Admin Panel, Provider dashboard, or deployment work was added.

---

## 1. Why this revision was needed

After the first Post-QA Revision, further live review found the Video Curations section — while now visible and populated — still didn't deliver the full experience expected of a modern marketplace: cards showed a poster and a play icon but weren't clickable, so "play" was a promise the UI didn't keep. Separately, the homepage's promotional content was carried entirely by small offer cards, with no large, high-impact banner moment; and the footer, even after its first simplification (six columns → still six, just relabeled), remained denser than a modern marketplace footer should be.

Three changes were requested to address this, all implemented in this round.

## 2. Change 1 — Video Curations: a real popup, honestly

**The requirement:** every video card must open a popup when clicked, even though no real video files or URLs exist yet in this mock-data phase — and the same popup component must become a real player later, with no redesign, the moment a URL exists.

**What changed:**
- Every card in the rail is now a real `<button>` (previously a non-interactive `<div>`). Clicking any card — or reaching it with the keyboard and pressing Enter/Space — opens `VideoCurationModal`, a dialog rendered through a React portal to `document.body` so it always sits above the rail's own scroll-clipping container.
- Inside the modal, the media area branches on the same `VideoCuration` fields the data model already had:
  - `videoUrl` set → a real `<video controls autoPlay>` element.
  - no `videoUrl` but `externalUrl` set → an `<iframe>` embed.
  - neither set (true today, for all six mock curations) → an honest placeholder: a large film icon, the text "Video coming soon," the curation's real title, and its real description. **No fake video is played, no invented YouTube/Instagram URL is used, and no fabricated embed appears.**
- Cards also grew — 220/260/300px across breakpoints, up from 160/190px — and the centered play button grew with them (56px → 56–64px), so the section reads as a real, large-format video gallery rather than a row of small tiles. The section now has its own full-bleed dark band (`bg-neutral-950`) instead of sharing the page's white background, which is also what makes it visually prominent as its own distinct moment on the page, not just another white card rail.

**Accessibility (WAI-ARIA "Dialog (Modal)" pattern):**
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at the visible title.
- Focus moves to the close button the instant the modal opens.
- Focus is trapped inside the dialog while open (Tab/Shift+Tab cycles through the close button and, when present, the video/iframe/CTA — never escaping to the page behind it).
- Escape closes the modal from anywhere inside it.
- Clicking the dark backdrop closes it too; clicking inside the panel does not (event propagation is stopped there).
- Closing (by Escape, the X button, or backdrop click) returns focus to the exact card that opened it.
- The page's scroll is locked while the modal is open and restored on close — verified to cause no page-level horizontal or vertical overflow at any breakpoint.
- A dedicated axe-core pass was run with the modal open (see §6) — 0 violations, including the WCAG 2.1.2 "no keyboard trap" concern: Escape and the close button always provide a way out, which is what keeps a focus trap compliant rather than a trap in the accessibility-failure sense.

**Future Admin Panel architecture — stated exactly as required:**

> Video playback infrastructure is ready for future real media. Current cards open the video viewer, which shows an honest placeholder when no media URL/file is configured. Future Admin Panel media can populate the same component without a frontend redesign.

No changes were needed to the `VideoCuration` type — `thumbnail`, `videoUrl`, `externalUrl`, `durationSeconds`, `title`, `description`, `categoryId`/`serviceTypeId`, `sortOrder`, and `active` already covered everything the modal and card need.

**One architectural note, not a regression:** making the card interactive (it needs `onClick` state) meant it had to become a client component, but the existing thumbnail-existence check (`fs.existsSync`, Node-only) has to stay server-side. `VideoCurationRail.tsx` (server) now does that filesystem check and the category/service-type tag lookup once per curation and hands the client boundary (`VideoCurationGallery` → `VideoCurationCard` → `VideoCurationModal`) a plain, already-resolved, fully serializable list — no Node API or data-layer import ships to the browser.

## 3. Change 2 — Large Spotlight / promotional banners

**What changed:** a new `LargeSpotlightBanner` component now sits right after the trust strip — the homepage's primary promotional moment, at a scale the previous small cards never had. It's a carousel (when more than one offer is active): a large rounded banner with an offer badge, headline, supporting text, and a real CTA button on the left, over a full-bleed decorative visual on the right/background; left/right (desktop) and right/left prev/next arrows plus dot indicators for navigation when there's more than one banner.

**The small cards were kept, not replaced** (`SpotlightBanners`, unchanged) — the client's instruction was explicit that small cards shouldn't be a *replacement* for large banners, not that they should be removed. They now sit lower on the page, right after "Browse by Category," as a secondary recap of the same offers.

**Data and CTA — derived, not fabricated, no schema change:** the banner reuses the existing `Offer` entity (`title`, `description`, `discountType`/`discountValue`, `appliesTo`, `bannerImage` unused here — see below) — no new fields were added to `Offer`, since that type is shared with `OfferTile` on service pages. Two things a banner needs that `Offer` doesn't carry were derived at render time instead:
- **CTA label:** a fixed, honest "Explore offer" — no invented urgency copy.
- **CTA destination:** resolved from `offer.appliesTo` to a real, working route — a `category`-scoped offer links to that category's page (city-scoped when a city is known, the city-agnostic `/services/[category]` fallback otherwise); a `service`-scoped offer resolves the service → its product → that product's category; an `all`-scope offer links to the general `/services` listing. Verified all four real offers resolve to real, existing, 200-status routes (see §6).

A future Admin Panel can add explicit `ctaText`/`ctaLink`/`bannerImageMobile` fields directly to `Offer` — this component would simply prefer those over its derived defaults, with no redesign.

**New artwork, not reused thumbnails:** the small cards' existing `bannerImage` assets (`public/images/offers/banner-*.svg`) have each offer's title baked directly into the SVG at thumbnail scale. Reusing them at full banner width would show the title twice — once as image content, once as this component's real HTML heading. Instead, two new, original, text-free decorative SVGs were created (`public/images/spotlight/large-banner-teal.svg`, `large-banner-amber.svg`) in the same brand-teal/accent-gold gradient language as the existing `scripts/gen_banners.py` assets — abstract soft circles only, no baked text — so the real headline and description are always live, accessible HTML text, never a duplicate or an image caption.

## 4. Change 3 — Footer, simplified further

The first Post-QA Revision's footer (see `PHASE_4_POST_QA_REVISION.md` §3) had already dropped the "Popular Services" mislabel and added a "For Professionals" column, but still carried six columns, including a full per-product "Services" list and a full "Service Areas" city list — still dense, still catalog-shaped. This round:

- **Columns reduced from six to three:** Company (now also carrying Privacy Policy / Terms & Conditions, merged in from the old separate Legal column, per the client's explicit "COMPANY: ... Privacy Policy, Terms & Conditions" spec), For Customers (renamed from "Customer"), and For Professionals (unchanged honest "coming soon" placeholder text).
- **The per-product "Services" column and the "Service Types" column are gone entirely** — the client's instruction was explicit: no giant appliance/service/city/service-type columns, the footer should not become a catalog. Product and category browsing already has its own dedicated homepage section (Browse by Category) and header search; the footer doesn't need to repeat it.
- **Service Areas is now a compact, single wrapped line** ("Also serving: Ranchi, Delhi, Mumbai, ...") under the column grid, not its own column — still only real, active cities from the mock data model, never an invented launch city.
- **Bottom bar unchanged:** copyright + Privacy Policy + Terms & Conditions. (Legal links intentionally appear in both the Company column and the bottom bar — the client's spec listed them in both places.)
- Social links remain gated on `ContactInfo.socialLinks` being non-empty (still empty today, so nothing fake renders). No App Store/Play Store badges — there's no app.

## 5. Homepage information architecture

Updated section order for both `/` and `/[city]`:

Header → Hero → Trust strip → **Large Spotlight banner** → New & Noteworthy → Featured Services → Category-wise rails → Browse by Category → Spotlight/Offers (compact) → How It Works → **Video Curations** → FAQ → Final CTA → Footer.

This keeps every required element (prominent hero, service discovery, a large promotional banner, service rails, video curation, category discovery, informational sections, a clean footer) while deviating from the client's suggested exact ordering in one place, as explicitly permitted: rather than two separate large-banner placements with the same four offers awkwardly split across them, there's one large banner carousel (all four offers) as the strong early primary moment, and the compact small-card recap lower down — avoiding a redundant near-duplicate banner appearing twice on one page. Video Curations kept its existing, already-proven position right before FAQ rather than moving, to minimize churn. No testimonials and no fabricated ratings were reintroduced anywhere in this pass.

## 6. Testing performed

All checks ran against a clean production build (`rm -rf .next && next build`, zero errors) on a freshly started server.

**Static analysis:** `tsc --noEmit` — 0 errors. `eslint` — 0 errors (2 warnings, both in this round's own temporary QA scripts, not application code).

**Functional regression (49 checks, automated via Playwright), all passed:**
- Route × breakpoint sweep — 14 routes × 7 breakpoints (1440/1280/1024/768/390/375/360) — 0 overflow, 0 broken images, 0 console errors, 0 network errors.
- Testimonials and star ratings confirmed still absent on `/` and `/ranchi`.
- No "Urban Company" text anywhere in the rendered homepage.
- Large Spotlight banner: visible and renders on `/` and `/ranchi` at desktop and mobile; CTA link present and verified to resolve to a real route for all four offers (`/services`, `/ranchi/consumer-durables` ×2, `/ranchi/water-air-purifiers` — confirmed with direct HTTP checks, all 200); causes no horizontal overflow at any tested width.
- Video Curations, at both 1440 and 390: section heading visible; all 6 cards render; **clicking a card opens the popup**; **no `<video>`/`<iframe>` element exists** (correctly honest, since no real media is configured); the **"Video coming soon" placeholder is shown**; **focus moves into the modal on open**; **Escape closes the modal**; **focus returns to the triggering card**; reopening and **closing via the X button** also works; no page overflow after any of these interactions.
- Footer: no leftover "Popular Services"/"Service Types" text; exactly 3 columns (Company / For Customers / For Professionals); "For Professionals" present; the compact "Also serving" cities line present; Privacy Policy, Terms, and copyright present; no horizontal overflow at desktop or mobile; all 18 footer links resolve with a 2xx/3xx status.

**Accessibility (axe-core, WCAG 2.1 A/AA + best-practice tags), 18 checks — 0 violations:** the same 16 route/breakpoint combinations as the previous revision, plus two dedicated checks with the video modal open (desktop and mobile). One real issue was caught and fixed mid-round: the new footer's "Also serving" label and its city-separator commas used `text-neutral-500`/`-600` against the dark footer background, landing at 3.75:1 contrast (below the 4.5:1 WCAG AA threshold for normal text) — flagged identically on every single route since the footer is global. Fixed by switching both to `text-neutral-400` (the same shade already used, and already passing, for the footer's other muted text on this exact background). Re-scanned clean: 0 violations across all 18 checks, including with the modal open.

All of Phase 4's original accessibility fixes, and the one added in the first Post-QA Revision (`StickyMobileCTA`'s landmark role), were re-verified intact: `ServiceCard` `aria-label`s, keyboard-focusable rails, the heading-hierarchy fixes, the WCAG contrast fixes on pricing/WhatsApp buttons, and the sticky mobile CTA's `role="region"`.

**Screenshots** captured against the final build: full-page homepage at desktop and mobile, the Video Curations section at both, the video popup open (showing the honest placeholder state) at both, and the footer alone at both. Delivered alongside this report.

## 7. Explicit verification against the 9 requested checkpoints

1. ✅ Video card is clickable.
2. ✅ Video popup opens.
3. ✅ Popup works even when `videoUrl` is null (all six mock curations).
4. ✅ No fake video is played — honest "Video coming soon" placeholder shown instead.
5. ✅ Large promotional banners are actually visible between sections (right after the trust strip, on both `/` and `/ranchi`, desktop and mobile).
6. ✅ Footer is substantially cleaner and less dense (six columns → three, no per-product/per-type list).
7. ✅ No giant appliance/service/city list dominates the footer (Service Areas is now one compact line).
8. ✅ Testimonials remain completely absent (and no fabricated ratings were added).
9. ✅ Existing Phase 4 accessibility fixes remain intact (plus the one contrast issue this round introduced was caught and fixed before sign-off, not left for a future round).

## 8. Files changed this round

**New:**
- `src/components/home/VideoCurationModal.tsx` — the video popup/lightbox.
- `src/components/home/VideoCurationGallery.tsx` — client boundary holding the "which card is open" state and rendering the modal.
- `src/components/home/LargeSpotlightBanner.tsx` — the large promotional banner carousel.
- `public/images/spotlight/large-banner-teal.svg`, `public/images/spotlight/large-banner-amber.svg` — new, original, text-free banner artwork.
- `PHASE_4_POST_QA_REVISION_2.md` — this document.

**Edited:**
- `src/components/home/VideoCurationCard.tsx` — rebuilt as a client component: real `<button>`, larger card, accepts `onOpen`/`thumbnailExists`/`tagLabel` as props instead of computing them itself.
- `src/components/home/VideoCurationMedia.tsx` — larger centered play button; doc comment updated for the new always-clickable behavior.
- `src/components/home/VideoCurationRail.tsx` — stays a server component; now precomputes `thumbnailExists`/`tagLabel` and renders the new dark, prominent section band around `VideoCurationGallery`.
- `src/components/layout/Footer.tsx` — reduced to three columns, compact Service Areas line, merged Legal into Company.
- `src/app/page.tsx`, `src/app/[city]/page.tsx` — new section order; wired up `LargeSpotlightBanner` and moved `SpotlightBanners`; doc comments updated.

No other application files were modified. No backend, auth, payment, Admin Panel, Provider dashboard, or deployment code was added or touched.

## 9. Remaining limitations

- Video Curations still has no real, playable media — the popup is fully built and honestly shows "coming soon" for all six mock curations, exactly as required, pending real files/URLs and the future Admin Panel to manage them.
- The large banner CTA destinations are real and working, but the CTA label/link/mobile-image fields themselves are derived in code rather than stored on `Offer` — a future Admin Panel adding those fields directly is a natural next step, not required now.
- "For Professionals" still links to nothing — no provider registration/login route exists in this frontend-only phase.
- All previously open business/product decisions (multi-city cart behavior, Offer/offerPrice precedence, login method, payment gateway, booking/cancellation rules, coupons/wallet/refunds, provider assignment/tracking, final launch cities, final catalogue/pricing, and Admin/Provider dashboard scope) remain open and were not touched or resolved by this revision.

---

**Status:** This revision and its regression QA are complete. Per the agreed waterfall process, work stops here pending explicit approval. No deployment, backend, database, authentication, payment integration, Admin Panel, Provider dashboard, or Phase 5 work has been started.
