import Link from "next/link";
import {
  getFooterCompanyNav,
  getFooterCustomerNav,
  getFooterLegalNav,
  getContactInfo,
} from "@/lib/data";
import { Container } from "@/components/ui/Container";
import { Icon } from "@/lib/icons";
import { getBrandingLive, getContactInfoLive } from "@/lib/data/live";

/**
 * Global marketplace footer — redesigned a third time in the "FINAL
 * HOMEPAGE / UX CORRECTION" pass. Post-QA Revision 2 (see
 * PHASE_4_POST_QA_REVISION_2.md §5) had already cut the footer to three
 * columns plus a compact "Also serving <cities>" line. The client's
 * follow-up, reference-driven feedback (Urban Company's own footer — no
 * city list at all) was explicit: even that compact line is redundant,
 * because location is already chosen once at the top of the site via the
 * location selector — a footer city list doesn't add anything a visitor
 * can't already do. So this version:
 *
 *  - Drops the "Also serving <cities>" line entirely. `getAllCitiesSync`
 *    is no longer imported here — city data itself is untouched and still
 *    backs the location selector, `/[city]` routes, etc.
 *  - Merges Legal into Company (About Us, Contact Us, Privacy Policy,
 *    Terms & Conditions) and drops the FAQ link from this column — FAQ
 *    is no longer part of the homepage's story and the footer shouldn't
 *    be the one place still pointing at it prominently; the `/faq` route
 *    itself is untouched and still reachable by anyone who lands on it
 *    directly. Legal links are *also* repeated in the bottom bar, per the
 *    client's spec listing them in both places.
 *  - For Customers: exactly the three links the client specified (Login,
 *    My Orders, Contact Us) rather than the previous five-item account
 *    nav — Addresses/Cart are one click away from My Account itself.
 *  - For Professionals is gone, not just de-clawed. The client's own
 *    instruction for this exact situation: "If there is no destination
 *    yet, remove the item entirely" — and no service-provider
 *    registration/login route exists anywhere in this frontend (verified
 *    against the app's route list), so there's genuinely nothing to link
 *    to. No "coming soon" text anywhere in the footer now (or the rest of
 *    the site — see the WhatsApp/mobile-nav changes in the same revision).
 *  - Social links stay gated on `ContactInfo.socialLinks` being non-empty
 *    (still empty in mock data, so nothing fake renders — unchanged). No
 *    App Store/Play Store badges — there is no app.
 */
export async function Footer() {
  const companyNav = getFooterCompanyNav();
  const contactLink = companyNav.find((item) => item.label === "Contact Us" || item.label === "Contact");
  const companyLinks = [
    ...companyNav.filter((item) => item.label !== "FAQ"),
    ...getFooterLegalNav(),
  ];
  // "For Customers": exactly Login, My Orders, Contact Us, per the client's spec
  // — Contact Us is deliberately repeated from the Company column above (the
  // client's own spec lists it in both groups), not a data-layer duplicate.
  const customerLinks = [
    ...getFooterCustomerNav().filter((item) => ["Login", "My Orders"].includes(item.label)),
    ...(contactLink ? [contactLink] : []),
  ];
  const legalLinks = getFooterLegalNav();

  // HOMEPAGE ADMIN REBUILD ("Header and branding" / footer): the logo and
  // social links now prefer the Admin-managed `branding`/`contact_info`
  // singletons (same existing backend tables/API as Header.tsx, previously
  // unread anywhere) over the static mock data, falling back to the exact
  // same mock-derived values when nothing's been set or the backend is
  // unreachable — nav links themselves are untouched/still mock-sourced
  // (flagged, not wired, in the accompanying phase report).
  const [branding, liveContactInfo] = await Promise.all([getBrandingLive(), getContactInfoLive()]);
  const logoSrc = branding?.logoUrl || "/images/brand/handyman-logo.jpg";
  const logoAlt = branding?.logoAlt || "Handyman Services";
  const socialLinks = liveContactInfo?.socialLinks?.length ? liveContactInfo.socialLinks : getContactInfo().socialLinks;
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-neutral-200 bg-neutral-900 pb-16 pt-12 text-neutral-300">
      <Container>
        <div className="mb-10 flex max-w-sm flex-col gap-4">
          <div>
            {/*
              The footer has real vertical room, unlike the header's fixed
              64px bar, so this shows the official logo's full lockup
              (mascot + "HANDYMAN SERVICES" wordmark, baked into the source
              image as supplied) rather than a cropped icon — and the
              separate HTML "Handyman Services" text label is dropped here
              specifically so the brand name isn't shown twice in one
              block. Height-constrained with `w-auto` so the image's own
              aspect ratio (1080×984) is preserved, never stretched.
            */}
            {/* eslint-disable-next-line @next/next/no-img-element -- official brand asset, full lockup, aspect ratio preserved via h-14/w-auto */}
            <img
              src={logoSrc}
              alt={logoAlt}
              className="h-14 w-auto rounded-lg sm:h-16"
            />
            <p className="mt-3 text-sm text-neutral-400">
              Book reliable appliance services at home.
            </p>
          </div>

          {/*
            Polish pass: social links, data-driven off the same
            `ContactInfo.socialLinks` field the type already carried.
            `contact.json`'s list is empty today, so this renders nothing —
            an honest omission rather than fabricated brand links — and
            starts working the moment real URLs are added, no code change.
          */}
          {socialLinks.length > 0 && (
            <div className="flex items-center gap-3">
              {socialLinks.map((link) => (
                <a
                  key={link.platform}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.platform}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                >
                  {/* This icon set (lucide-react) has no brand/logo icons, so every
                      platform shares a plain globe glyph — the label conveys which
                      platform it is; see the aria-label above. */}
                  <Icon name="globe" className="h-4 w-4" />
                </a>
              ))}
            </div>
          )}
        </div>

        {/*
          Two nav groups only — "For Professionals" is not rendered at all.
          The client's own instruction for this exact case: "Use only a
          normal 'Become a Service Provider' link/button if the page
          exists. If there is no destination yet, remove the item
          entirely." No service-provider registration/login route exists
          anywhere in this frontend (this phase never built one — provider
          tooling is explicitly out of scope, see PHASE_2_OPEN_QUESTIONS.md),
          so per that instruction the column is omitted rather than shown
          as a dead link or another "coming soon" label.
        */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:max-w-md">
          {companyLinks.length > 0 && (
            <FooterColumn title="Company">
              <ul className="space-y-1.5">
                {companyLinks.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-sm transition-colors hover:text-white">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </FooterColumn>
          )}

          {customerLinks.length > 0 && (
            <FooterColumn title="For Customers">
              <ul className="space-y-1.5">
                {customerLinks.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-sm transition-colors hover:text-white">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </FooterColumn>
          )}
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-neutral-800 pt-6 text-sm text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Handyman Services. All rights reserved.</p>
          {legalLinks.length > 0 && (
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
              {legalLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="transition-colors hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-100">
        {title}
      </h2>
      {children}
    </div>
  );
}
