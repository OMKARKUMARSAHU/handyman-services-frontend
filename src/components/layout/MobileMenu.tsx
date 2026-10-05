"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/state/AuthProvider";
import type { Role } from "@/lib/auth/types";

/**
 * Mobile "hamburger" drawer — rebuilt in the "FINAL UX + CART FUNCTIONALITY
 * CORRECTION" pass as a genuine PRIMARY NAVIGATION menu, not a copy of the
 * footer.
 *
 * AUTH/SESSION AUDIT FIX: the "Login" row below used to be a static link
 * regardless of sign-in state — same bug as the old AccountButton (see
 * that file's comment). A signed-in customer/admin/provider opening this
 * drawer always saw "Login" even though their session was perfectly
 * valid, which is one of the ways the app could LOOK logged out without
 * actually being logged out. The nav list is now built per-render from
 * real auth state: signed out keeps "Login"; signed in shows "My
 * Account" (routed to that role's own dashboard) plus a real "Log out"
 * action that calls the same `logout()` every other dashboard uses.
 *
 * "My Orders" stays pointed at `/account/orders` unconditionally — that
 * route already handles its own "sign in to view" stub (AccountPreAuth)
 * for guests, so no duplicate auth branching is needed here.
 */
const BASE_NAV = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "My Orders", href: "/account/orders" },
];

const TRAILING_NAV = [
  { label: "About Us", href: "/about" },
  { label: "Contact Us", href: "/contact" },
  { label: "FAQ", href: "/faq" },
];

const DASHBOARD_HREF_BY_ROLE: Record<Role, string> = {
  customer: "/account",
  provider: "/provider",
  admin: "/admin",
};

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();

  const accountItem = user
    ? { label: "My Account", href: DASHBOARD_HREF_BY_ROLE[user.role] }
    : { label: "Login", href: "/login" };

  const navItems = [...BASE_NAV, accountItem, ...TRAILING_NAV];

  async function handleLogout() {
    setOpen(false);
    await logout();
    router.push("/login");
  }

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
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 hover:text-brand-700"
            >
              {item.label}
            </Link>
          ))}
          {user && (
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-50 hover:text-brand-700"
            >
              Log out
            </button>
          )}
        </nav>
      </div>
    </div>
  );
}
