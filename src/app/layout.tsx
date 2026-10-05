import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import { CartProvider } from "@/lib/state/CartProvider";
import { LocationProvider } from "@/lib/state/LocationProvider";
import { AuthProvider } from "@/lib/state/AuthProvider";
import { CitySelectorModal } from "@/components/location/CitySelectorModal";
import "./globals.css";

// Note: this build environment could not reach fonts.googleapis.com to
// self-host next/font/google at build time, so the design system falls back
// to a native system font stack (defined in globals.css). This has no
// functional downside — it avoids a font network request entirely, which is
// a performance win (see PHASE_2_UI_UX_DESIGN.md §8) — and can be swapped
// for a bundled/self-hosted brand font later via next/font/local.

// Phase 3 header/footer revision — drive-by fix: the previous copy here
// ("Your home appliances, always running." / "One annual plan covers all
// your appliances...") was written for the old Silver/Gold/Platinum plans
// site. Updated to the marketplace framing already approved for the
// homepage (visual revision round: "book services at doorstep", not "buy
// annual plan") — no new business claims introduced.
// Phase 3 final-polish pass (item 2): "book certified technicians" asserted
// a certification claim no client-confirmed process backs — reworded to
// describe what the site does (browse/compare/book) rather than an
// unverified quality claim about the technicians themselves.
export const metadata: Metadata = {
  metadataBase: new URL("https://handymanservices.in"),
  title: {
    default: "Handyman Services — Book trusted appliance services near you",
    template: "%s | Handyman Services",
  },
  description:
    "Browse services by category, compare options, and book installation, service, repair or AMC for your home appliances — AC, washing machine, refrigerator, and more.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-lg"
        >
          Skip to content
        </a>
        <LocationProvider>
          <CartProvider>
            <AuthProvider>
              <Header />
              <main id="main-content" className="flex-1">
                {children}
              </main>
              <Footer />
              {/*
                "FINAL HOMEPAGE / UX CORRECTION" item 13: the old mobile-only
                `StickyMobileCTA` rendered a full-width "Chat on WhatsApp" bar
                fixed to the bottom of the screen — the client called this out
                explicitly as unacceptable (it occupies its own section, can
                collide with the browser's own bottom chrome, and reads as a
                persistent layout element rather than a small utility action).
                It's deleted, not just hidden — see git history for the old
                component if a full-width variant is ever wanted back.
                `WhatsAppButton`'s `floating` variant (small, circular, fixed
                bottom-right, safe-area aware — see that component) now
                renders unconditionally at every breakpoint instead of only
                `md:flex`, so there is exactly one WhatsApp entry point, and
                it never pushes content, changes page layout, or spans full
                width on any screen size.
              */}
              <div role="complementary" aria-label="WhatsApp contact">
                <WhatsAppButton variant="floating" />
              </div>
              <CitySelectorModal />
            </AuthProvider>
          </CartProvider>
        </LocationProvider>
      </body>
    </html>
  );
}
