import Link from "next/link";
import { getFooterNav, getFooterLegalNav, getContactInfo } from "@/lib/data";
import { Container } from "@/components/ui/Container";

export function Footer() {
  const navItems = getFooterNav();
  const legalItems = getFooterLegalNav();
  const contact = getContactInfo();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-neutral-200 bg-neutral-900 pb-20 pt-12 text-neutral-300 md:pb-12">
      <Container>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="mb-3 flex items-center gap-2 text-lg font-extrabold text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-black text-white">
                HS
              </span>
              Handyman Services
            </div>
            <p className="text-sm text-neutral-400">
              Your home appliances, always running.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-100">
              Navigate
            </h2>
            <ul className="space-y-2">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-100">
              Contact
            </h2>
            <ul className="space-y-2 text-sm">
              <li>
                <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="hover:text-white">
                  {contact.phone}
                </a>
              </li>
              {contact.email && (
                <li>
                  <a href={`mailto:${contact.email}`} className="hover:text-white">
                    {contact.email}
                  </a>
                </li>
              )}
              {contact.address && <li>{contact.address}</li>}
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-100">
              Legal
            </h2>
            <ul className="space-y-2">
              {legalItems.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-neutral-800 pt-6 text-sm text-neutral-400">
          © {year} Handyman Services. All rights reserved.
        </div>
      </Container>
    </footer>
  );
}
