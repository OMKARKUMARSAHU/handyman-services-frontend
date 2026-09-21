# Phase 4 — Post-QA Revision

**Date:** 2026-09-21
**Scope:** Three focused frontend fixes reported after live review of the Phase 4 build — Video Curations visibility, complete Testimonials removal, and a footer redesign — plus a full non-regression QA pass and a device sync that closes a gap discovered during this round.

This document is an addendum to `PHASE_4_TEST_REPORT.md`, not a replacement for it. Nothing described here revisits any open business decision (multi-city cart, Offer/offerPrice precedence, login method, payment gateway, booking rules, coupons/wallet/refunds, provider assignment/tracking, launch cities, final catalogue/pricing, or Admin/Provider dashboard scope), and no backend, database, authentication, payment, Admin Panel, Provider dashboard, or deployment work was added.

---

## 1. Why this revision was needed

After Phase 4 sign-off, live review of the site reported that the Video Curations section wasn't visibly showing on the homepage. Investigating this surfaced two separate issues, addressed together in this round:

1. **A real UI gap** — the video card showed only a title, with no description, so the section read as sparse even where it did render.
2. **A sync/delivery gap (the actual root cause of "not visible")** — see §2 below. This was the dominant cause of the report: on the machine where the site was actually being reviewed, the Video Curations feature did not exist in the code at all.

Two other changes were requested alongside the fix: removing Testimonials entirely (mock quotes/ratings with no real reviews behind them), and restructuring the footer into a clearer marketplace layout.

## 2. Root cause: cloud vs. local device sync gap

A checksum comparison (`md5sum` over every file in `src/`, `public/`, and `scripts/`) between this working environment and the local project copy at `C:\Projects\Handyman` found:

- **4 files that had never been synced to the local copy, ever:** `src/components/home/VideoCurationCard.tsx`, `src/components/home/VideoCurationMedia.tsx`, `src/data/video-curations.json`, `src/lib/data/videoCurations.ts`. The rail component (`VideoCurationRail.tsx`) *was* present locally, but its dependencies were not — so the section had no data or card component to render from.
- **7 additional files present locally but stale** (content differed from the current, tested version here): `src/app/[city]/page.tsx`, `src/app/page.tsx`, `src/components/layout/Footer.tsx`, `src/lib/data/index.ts`, `src/lib/format.ts`, `src/lib/icons.tsx`, `src/types/index.ts`.

In other words: this was never a code or design defect in the environment that was tested and signed off in Phase 4 (Video Curations passed all of its dedicated checks there). It was a delivery failure in an earlier round's file sync, despite that round reporting the files as synced. This revision's sync step (§6) fixes that gap directly — not just for the files this round touched, but for the entire tree, verified by checksum.

## 3. Change 1 — Video Curations visibility

- **Sync fix:** the four missing files above are now present on the local copy (§6), so the section renders there as it always has here.
- **UI enhancement:** each video card now also shows the curation's `description` field (already part of the data model, just not previously rendered) beneath the title, one line, shown only when the field is set. Nothing was fabricated — the six existing `video-curations.json` entries already carried real descriptive text (e.g. "A walkthrough of a typical visit, start to finish — arrival, diagnosis, the work itself, and the WhatsApp summary afterward.").
- **Card contents, unchanged from Phase 3 and confirmed still honest:** a thumbnail area (falls back to a neutral icon tile when no thumbnail file exists on disk — checked server-side, not guessed), a play-button affordance, a duration badge only when `durationSeconds` is set, a category/service-type tag chip, title, and now description. The card is **not** wrapped in a link or button — every curation's `videoUrl`/`externalUrl` is still `null` in the mock data, so making it "clickable" would either be a dead link or a fabricated destination. This is unchanged, deliberate, and re-verified this round (see §7, check 3).
- **Video Curations UI is implemented and ready for future real media, while actual video media will be managed through the future Admin Panel/backend.** The `VideoCuration` type (`thumbnail`, `videoUrl`, `externalUrl`, `durationSeconds`, `sortOrder`, `active`, plus `title`/`description`/`categoryId`/`serviceTypeId`) already covers everything a future Admin Panel would need to manage: upload/replace a thumbnail, attach a video file or URL, edit title/description/category, set duration, reorder, and activate/deactivate — no schema change was needed for this revision.

## 4. Change 2 — Testimonials removed

- The entire Testimonials section (customer quotes, names, locations, star ratings, its heading, and the carousel) was removed from both `src/app/page.tsx` and `src/app/[city]/page.tsx`. Nothing was put in its place.
- **The component and data were kept, not deleted:** `TestimonialCarousel.tsx`, `TestimonialCard.tsx`, `src/lib/data/testimonials.ts`, and `src/data/testimonials.json` all still exist, unused, for when real reviews exist to show. This preserves the architecture without presenting placeholder content as current customer evidence.
- The existing accessibility fix on `TestimonialCarousel.tsx` (the scrollable-region `aria-label`/`tabIndex`/focus-ring fix from Phase 4) was left in place rather than stripped out along with its usage — no reason to regress a fix on a component that's still in the codebase.

## 5. Change 3 — Footer redesign

Restructured using the Urban Company footer screenshot strictly as a general layout/IA reference (column groupings, a bottom bar) — no Urban Company text, branding, links, or assets were copied; the footer is 100% Handyman Services' own copy and data.

New structure (6 columns + a bottom bar, all still data-driven off the existing DAL — no hand-typed link lists):

- **Services** — active products, linking to the existing city-agnostic `/services/[category]` route (unchanged from before).
- **Service Types** (renamed from "Popular Services") — Installation/Service/Repair/AMC. This list was always service *types*, not a ranked "popularity" claim, so the old label was inaccurate; it's plain text, not links, since no page currently filters by type alone — same honesty rule already used for non-routable data elsewhere in this codebase.
- **Company** / **Customer** — unchanged, same footer nav data source the mobile menu already reads.
- **For Professionals** (new) — "Become a Service Provider" and "Service Provider Login," both plain, non-clickable text with a "coming soon" label. Service Provider is a confirmed target role from Phase 1, but no registration/login route exists yet (Provider routes are explicitly out of scope for this frontend) — this states the intent honestly without linking to a page that doesn't exist. No fabricated route was created.
- **Service Areas** — active cities only, unchanged.
- **Bottom bar** — copyright line + Privacy Policy / Terms & Conditions, moved out of the column grid into a dedicated bottom row, matching the requested "brand → columns → bottom bar" structure.
- No app-store download badges were added (there is no app to download).
- Social links remain gated on `ContactInfo.socialLinks` being non-empty (still empty in mock data today, so nothing fake renders) — unchanged from Phase 4.

## 6. Full device sync

The checksum gap found in §2 has been closed for the entire tree, not just the files this round edited:

**Previously missing, now delivered:**
`src/components/home/VideoCurationCard.tsx`, `src/components/home/VideoCurationMedia.tsx`, `src/data/video-curations.json`, `src/lib/data/videoCurations.ts`

**Previously stale, now updated (includes this round's own changes):**
`src/app/page.tsx`, `src/app/[city]/page.tsx`, `src/components/layout/Footer.tsx`, `src/lib/data/index.ts`, `src/lib/format.ts`, `src/lib/icons.tsx`, `src/types/index.ts`, `src/components/layout/StickyMobileCTA.tsx` (this round's a11y fix, §7)

**Verification:** an `md5sum` of every file under `src/`, `public/`, and `scripts/` was computed on both sides after the sync and reduced to a single aggregate hash. Both sides — 159 files each — now produce the identical aggregate hash (`56362a27...`), confirming full parity, not just parity on the files believed to be involved.

## 7. Regression QA

All checks were run against a clean production build (`rm -rf .next && next build`, zero errors) on a freshly started server, per the same methodology validated in Phase 4.

**Static analysis:** `tsc --noEmit` — 0 errors. `eslint` — 0 errors (2 warnings, both in this round's own temporary QA scripts, not application code).

**Functional regression (34 checks, automated via Playwright):**
1. Route × breakpoint sweep — the same 14 routes × 7 breakpoints (1440/1280/1024/768/390/375/360) as Phase 4 — 0 overflow, 0 broken images, 0 console errors, 0 network errors (98 checks collapsed into 1 pass/fail).
2. Testimonials confirmed absent on `/` and `/ranchi` — no testimonial-related heading/text, and (after correcting a test-locator false-positive that matched Tailwind's `snap-start`/`items-start` utility classes rather than an actual star icon) 0 real star-rating icons anywhere on either page.
3. Video Curations confirmed visible on `/`, `/ranchi`@1440, and `/ranchi`@390 — heading visible, all 6 cards render, each card's text (including the new description line) sampled and confirmed non-empty, and confirmed still non-actionable (no `<a>`/`<button>` wrapper — no fake playable link).
4. Footer confirmed restructured on `/ranchi`@1440 and @390 — "Popular Services" label gone, "Service Types" present, "For Professionals" present with its two lines confirmed non-clickable, Privacy Policy + Terms + copyright present in the bottom bar, no horizontal overflow, and all 21 footer links resolve with a 2xx/3xx status.
5. No "Urban Company" text anywhere in the rendered homepage.

Result: **34/34 passed.**

**Accessibility (axe-core, WCAG 2.1 A/AA + best-practice tags), 16 route/breakpoint checks** across every route touched directly or via the shared Footer: `/` and `/ranchi` at both 1440 and 390 (their own markup changed), the remaining 12 routes at 1440 (share only the Footer change). This re-run caught one real, pre-existing issue that Phase 4's original scan had not tested for:

- **Found:** `StickyMobileCTA` (the persistent mobile "Chat on WhatsApp" bar, `md:hidden`, present in the root layout since Phase 3) sits outside any landmark (`<main>`/`<footer>`/etc.) and only becomes visible below the `md` breakpoint — so it was invisible to any axe scan run at a desktop width, which is why it wasn't caught before. Axe's "region" rule (content must be contained by a landmark) flagged it at 390px on `/` and `/ranchi`. This is unrelated to any of this round's three requested changes; it surfaced only because this round's regression pass extended axe testing to a mobile breakpoint that hadn't been scanned before.
- **Fixed:** added `role="region"` and `aria-label="Quick contact"` to the bar — the same minimal pattern (landmark role + accessible name, no layout change) already used for the five scrollable-rail fixes in Phase 4. Re-scanned: 0 violations.

All five of Phase 4's original accessibility fixes were re-verified intact and unregressed: `ServiceCard` `aria-label`s, keyboard-focusable rails (`ServiceRail`, `VideoCurationRail`, `SpotlightBanners`, `TrustStrip`, and `TestimonialCarousel` — still present though unused), the two heading-hierarchy fixes on the category/product pages, and the WCAG contrast fixes on struck-through MRP text and the WhatsApp buttons.

**Result: 0 axe-core violations across all 16 checks** (after the one fix above), matching Phase 4's original 0-violations state.

**Screenshots** captured against the final build: full-page homepage at desktop (1440) and mobile (390), the Video Curations section at both, and the footer alone at both. Delivered alongside this report.

## 8. Explicit verification against the 8 requested checkpoints

1. ✅ Video is visible on the homepage (both `/` and `/ranchi`, desktop and mobile).
2. ✅ Cards show a clear video visual (thumbnail/fallback tile + play-button affordance + duration badge where real).
3. ✅ No fake playable video — cards remain non-actionable; no invented URLs or embeds.
4. ✅ Testimonials text/quotes absent.
5. ✅ Star ratings absent (confirmed via actual icon check, not a class-name substring match).
6. ✅ Footer restructured per the requested column set and bottom bar, with "Service Types" replacing "Popular Services."
7. ✅ No Urban Company content (text, branding, or assets) present anywhere in the codebase or rendered output — the screenshot was used strictly as a structural reference.
8. ✅ All Phase 4 accessibility fixes intact, plus one additional pre-existing issue found and fixed this round (§7).

## 9. Files changed this round

- `src/app/page.tsx` — Testimonials section removed; doc comment updated.
- `src/app/[city]/page.tsx` — Testimonials section removed.
- `src/components/home/VideoCurationCard.tsx` — description line added to the card overlay.
- `src/components/layout/Footer.tsx` — restructured (Service Types rename, For Professionals column added, Legal moved to a new bottom bar).
- `src/components/layout/StickyMobileCTA.tsx` — accessibility fix found during this round's regression pass (`role="region"` + `aria-label`).
- `PHASE_4_POST_QA_REVISION.md` — this document.

No other application files were modified. No backend, auth, payment, Admin Panel, Provider dashboard, or deployment code was added or touched.

## 10. Remaining limitations (unchanged from Phase 4, restated for clarity)

- Video Curations has no real, playable media yet — thumbnails and descriptions are real, but `videoUrl`/`externalUrl` are `null` across all six mock entries, by design, until real media and an Admin Panel exist to manage it.
- Testimonials, once real reviews exist, need the (already-built) `TestimonialCarousel`/`TestimonialCard` wired back in with real data — not attempted here, since inventing reviews was explicitly out of scope.
- "For Professionals" links to nothing yet — no provider registration/login route exists in this frontend-only phase.
- All previously open business/product decisions (multi-city cart behavior, Offer/offerPrice precedence, login method, payment gateway, booking/cancellation rules, coupons/wallet/refunds, provider assignment/tracking, final launch cities, final catalogue/pricing, and Admin/Provider dashboard scope) remain open and were not touched or resolved by this revision.

---

**Status:** This revision and its regression QA are complete. Per the agreed waterfall process, work stops here pending explicit approval. No deployment, backend, database, authentication, payment integration, Admin Panel, Provider dashboard, or Phase 5 work has been started.
