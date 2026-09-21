"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Mobile "hamburger" drawer — rebuilt in the "FINAL UX + CART FUNCTIONALITY
 * CORRECTION" pass as a genuine PRIMARY NAVIGATION menu, not a copy of the
 * footer.
 *
 * The previous version read the same Company/Customer/Legal nav groups the
 * footer renders (About Us, Contact Us, FAQ / Login, My Account, My Orders,
 * Addresses, Cart / Privacy Policy, Terms & Conditions) — nine links across
 * three headed groups, effectively reproducing the footer inside a drawer.
 * The client's explicit correction: the hamburger is mobile's primary nav
 * entry point (now that the standalone Account icon is gone from the mobile
 * header — see Header.tsx), and primary navigation, account access, cart,
 * and footer/legal navigation are four different concepts that shouldn't
 * all render the same link list.
 *
 * So this is now a single flat, compact list — real routes only, nothing
 * invented:
 *   Home         /
 *   Services     /services
 *   My Orders    /account/orders   (an honest "sign in to view" stub today —
 *                                    see AccountPreAuth.tsx — not a fake
 *                                    order history)
 *   Login        /login
 *   About Us     /about
 *   Contact Us   /contact
 *   FAQ          /faq              (the homepage dropped its FAQ preview
 *                                    section, but the standalone /faq route
 *                                    is still real and still worth a link)
 *
 * Cart is deliberately absent — it already has its own always-visible header
 * icon+badge (CartButton), so listing it again here would be the same
 * duplication this pass is removing. Company/Customer/Legal links
 * (Privacy Policy, Terms & Conditions, Addresses, Cart) stay footer-only.
 */
const PRIMARY_NAV = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "My Orders", href: "/account/orders" },
  { label: "Login", href: "/login" },
  { label: "About Us", href: "/about" },
  { label: "Contact Us", href: "/contact" },
  { label: "FAQ", href: "/faq" },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
          className="h-5 w-5"
        >
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>

      {/*
        Positioned absolutely against `header` (the nearest positioned
        ancestor — `position: sticky` establishes one, and the header
        itself spans the full viewport width) rather than `fixed`+a
        hardcoded top offset, so it always lands directly below the full
        header — flush with both edges — regardless of whether the mobile
        Location/Search row underneath it is present.
      */}
      <div
        id="mobile-nav-panel"
        className={cn(
          "absolute inset-x-0 top-full z-30 origin-top border-b border-neutral-200 bg-white shadow-lg transition-all",
          open
            ? "visible translate-y-0 opacity-100"
            : "invisible -translate-y-2 opacity-0"
        )}
      >
        <nav
          aria-label="Primary"
          className="flex max-h-[calc(100vh-4rem)] flex-col gap-0.5 overflow-y-auto px-2 py-2 sm:px-3"
        >
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 hover:text-brand-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
