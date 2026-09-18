import Link from "next/link";
import { getPrimaryNav, getContactInfo, getTelLink } from "@/lib/data";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { MobileMenu } from "./MobileMenu";
import { SearchBox } from "./SearchBox";
import { LocationSelector } from "./LocationSelector";
import { AccountButton } from "./AccountButton";
import { CartButton } from "./CartButton";

export function Header() {
  const navItems = getPrimaryNav();
  const contact = getContactInfo();

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-2">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-lg font-extrabold tracking-tight text-neutral-900"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-black text-white">
            HS
          </span>
          <span className="hidden sm:inline">Handyman Services</span>
        </Link>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-6 xl:gap-8">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm font-medium text-neutral-700 transition-colors hover:text-brand-700"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-0.5 sm:gap-1">
          <SearchBox />
          <LocationSelector />
          <AccountButton />
          <CartButton className="hidden lg:flex" />
          <a
            href={getTelLink()}
            className="hidden pl-1 text-sm font-semibold text-brand-700 hover:text-brand-800 xl:block"
            aria-label={`Call ${contact.phone}`}
          >
            {contact.phone}
          </a>
          {/*
            Wrapped in a span rather than passing "hidden lg:inline-flex"
            straight to Button's className: Button's own base classes always
            start with the unprefixed utility "inline-flex", and cn() (plain
            clsx, no tailwind-merge) does not dedupe/override conflicting
            unprefixed utilities — the winner then depends on Tailwind's
            internal generation order for that pair of class names rather
            than source order, which combined "hidden" + "inline-flex" the
            wrong way and left this button visible on mobile. A wrapper
            element with no competing base "inline-flex"/"flex" class of its
            own can safely carry the responsive hide/show classes instead.
          */}
          <span className="ml-1 hidden lg:inline-flex">
            <Button href="/contact" size="md">
              Request a Service
            </Button>
          </span>
          <MobileMenu items={navItems} />
        </div>
      </Container>
    </header>
  );
}
