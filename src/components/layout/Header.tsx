import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { MobileMenu } from "./MobileMenu";
import { SearchBox } from "./SearchBox";
import { LocationSelector } from "./LocationSelector";
import { AccountButton } from "./AccountButton";
import { CartButton } from "./CartButton";
import { getBrandingLive } from "@/lib/data/live";

/**
 * Global marketplace header (Phase 3 header/footer revision).
 *
 * Replaces the earlier brochure-site header (Home/Services/Contact nav,
 * visible phone number, "Request a Service" CTA) with the
 * Location → Search → Cart → Account information architecture the
 * City → Category → Product → Service Type → Service → Cart → Checkout
 * → Order product model needs. Urban Company's header
 * (urbancompany.com/ranchi) was used only as a UX/IA reference for this
 * layout — no Urban Company branding, copy, or assets are used, and the
 * logo/colors/icon set here are the existing Handyman ones.
 *
 * Location, Search, Cart, and Account are the same components as before,
 * restyled — none of their underlying state or data logic changed:
 * Location still reads/writes LocationProvider, Search still runs through
 * the existing SearchBox DAL-backed filter + results modal, Cart still
 * reads CartProvider, and Account still links to the existing /login shell.
 *
 * Layout: a single row at `md` and up (logo left; Location + Search
 * centered; Cart/Account/mobile-menu right). Below `md`, Location and
 * Search move to a second full-width row so the icon cluster in row one
 * never has to shrink — verified clean at 360–390px.
 *
 * "FINAL UX + CART FUNCTIONALITY CORRECTION" item 2: below `md` the
 * standalone Account icon is hidden — the hamburger is mobile's one
 * primary-navigation entry point (it has its own "Login" item), so the
 * icon row there is just [Cart] [Hamburger]. Desktop keeps Cart + Account
 * + (hidden) hamburger, unchanged.
 */
export async function Header() {
  // HOMEPAGE ADMIN REBUILD ("Header and branding"): an Admin-uploaded logo
  // (backend's existing `branding` singleton table/API — previously built
  // but never read anywhere) takes over this badge when set, falling back
  // to the original fixed asset otherwise — same `admin value ?? default`
  // fallback contract as every other live-wired field in this project
  // (see HeroDiscoveryPanel.tsx, CategoryCard.tsx). Never blocks/breaks
  // the header if the backend is slow or unreachable: getBrandingLive()
  // already degrades to `null` in that case.
  const branding = await getBrandingLive();
  const logoSrc = branding?.logoUrl || "/images/brand/handyman-logo.jpg";
  const logoAlt = branding?.logoAlt || "Handyman Services";

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <Container className="flex h-16 items-center gap-3">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-lg font-extrabold tracking-tight text-neutral-900"
        >
          {/*
            "FINAL HOMEPAGE / UX CORRECTION" item 11: the official supplied
            Handyman Services logo replaces the old text-based "HS" square.
            The row this sits in is a fixed 64px-tall sticky bar, so there
            isn't vertical room to show the full mascot+wordmark lockup
            legibly here — the badge shows just the mascot portion (a CSS
            crop via object-top/object-cover on the untouched source image,
            not a separately pre-cropped asset) and the real "Handyman
            Services" text stays live, accessible HTML next to it, same as
            before. The full lockup (mascot + "HANDYMAN SERVICES" wordmark
            baked into the image) is used at the footer's brand block
            instead, where there's room for it — see Footer.tsx.
          */}
          <span className="flex h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-neutral-950">
            {/*
              alt is the real "Handyman Services" name, not empty — the
              adjacent text span is `hidden` (display:none) below the `sm`
              breakpoint, and hidden text doesn't contribute to a link's
              accessible name, so the link needs its name from the image
              itself at every viewport (axe's link-name rule caught this
              with an empty alt during the mobile QA pass).
            */}
            {/* eslint-disable-next-line @next/next/no-img-element -- small fixed badge crop of the official brand asset; next/image's fixed sizing isn't needed here */}
            <img
              src={logoSrc}
              alt={logoAlt}
              className="h-full w-full object-cover object-top"
            />
          </span>
          <span className="hidden sm:inline" aria-hidden="true">
            Handyman Services
          </span>
        </Link>

        <div className="hidden min-w-0 flex-1 items-center justify-center gap-2 md:flex">
          <LocationSelector className="max-w-[180px]" />
          <SearchBox className="w-full max-w-sm lg:max-w-md" />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
          <CartButton />
          {/*
            "FINAL UX + CART FUNCTIONALITY CORRECTION" item 2: the mobile
            header keeps only [Logo] [Cart] [Hamburger] — the standalone
            account/person icon is desktop-only now. The hamburger drawer is
            mobile's primary navigation entry point and already includes a
            "Login" item (see MobileMenu.tsx), so the account icon isn't lost,
            just no longer duplicated as a second icon in the same row.
            `hidden md:block` on the wrapper (not a class appended to
            AccountButton itself) so a parent `display:none` reliably hides
            it below `md` regardless of AccountButton's own `flex` class.
          */}
          <div className="hidden md:block">
            <AccountButton />
          </div>
          <MobileMenu />
        </div>
      </Container>

      <Container className="flex items-center gap-2 border-t border-neutral-100 py-2 md:hidden">
        <LocationSelector className="max-w-[40%]" />
        <SearchBox className="min-w-0 flex-1" />
      </Container>
    </header>
  );
}
