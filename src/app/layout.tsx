import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { StickyMobileCTA } from "@/components/layout/StickyMobileCTA";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import "./globals.css";

// Note: this build environment could not reach fonts.googleapis.com to
// self-host next/font/google at build time, so the design system falls back
// to a native system font stack (defined in globals.css). This has no
// functional downside — it avoids a font network request entirely, which is
// a performance win (see PHASE_2_UI_UX_DESIGN.md §8) — and can be swapped
// for a bundled/self-hosted brand font later via next/font/local.

export const metadata: Metadata = {
  metadataBase: new URL("https://handymanservices.in"),
  title: {
    default: "Handyman Services — Your home appliances, always running.",
    template: "%s | Handyman Services",
  },
  description:
    "One annual plan covers all your appliances. Vetted, certified technicians, WhatsApp visit reports, and priority support.",
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
        <Header />
        <main id="main-content" className="flex-1 pb-16 md:pb-0">
          {children}
        </main>
        <Footer />
        <StickyMobileCTA />
        <div role="complementary" aria-label="WhatsApp contact">
          <WhatsAppButton variant="floating" className="hidden md:flex" />
        </div>
      </body>
    </html>
  );
}
