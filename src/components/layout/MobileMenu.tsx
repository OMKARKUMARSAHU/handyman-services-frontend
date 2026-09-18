"use client";

import { useState } from "react";
import Link from "next/link";
import type { NavItem } from "@/types";
import { cn } from "@/lib/utils";
import { getContactInfo, getTelLink, getWhatsAppLink } from "@/lib/data";
import { AccountButton } from "./AccountButton";
import { CartButton } from "./CartButton";

export function MobileMenu({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const contact = getContactInfo();

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
          className="h-6 w-6"
        >
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>

      <div
        id="mobile-nav-panel"
        className={cn(
          "fixed inset-x-0 top-16 z-30 origin-top border-b border-neutral-200 bg-white shadow-lg transition-all",
          open
            ? "visible translate-y-0 opacity-100"
            : "invisible -translate-y-2 opacity-0"
        )}
      >
        <nav aria-label="Mobile" className="flex max-h-[calc(100vh-4rem)] flex-col overflow-y-auto px-4 py-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="border-b border-neutral-100 py-3 text-base font-medium text-neutral-800 last:border-none hover:text-brand-700"
            >
              {item.label}
            </Link>
          ))}

          <Link
            href="/contact"
            onClick={() => setOpen(false)}
            className="mt-4 rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700"
          >
            Request a Service
          </Link>

          <div className="mt-3 flex items-center justify-center gap-2">
            <AccountButton showLabel className="border border-neutral-200" />
            <CartButton showLabel className="border border-neutral-200" />
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3 text-sm">
            <a href={getTelLink()} className="font-semibold text-brand-700 hover:text-brand-800">
              {contact.phone}
            </a>
            <a
              href={getWhatsAppLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-green-700 hover:text-green-800"
            >
              Chat on WhatsApp
            </a>
          </div>
        </nav>
      </div>
    </div>
  );
}
