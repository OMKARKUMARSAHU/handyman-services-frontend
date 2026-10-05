"use client";

import Link from "next/link";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/state/AuthProvider";
import type { Role } from "@/lib/auth/types";

/**
 * AUTH/SESSION AUDIT FIX: this used to be a static link to `/login`
 * regardless of sign-in state (see git history / the old comment this
 * replaces: "Account still links to the existing /login shell"). That
 * made a perfectly valid, still-active session (cookie intact,
 * AuthProvider's `user` populated) LOOK logged out the moment someone
 * glanced at the header after navigating — e.g. right after changing
 * city, since that's naturally when people check "am I still signed
 * in?" by looking at this icon. The underlying session was never
 * actually destroyed by a city change (AuthProvider lives in the root
 * layout and is never remounted by client-side navigation); this icon
 * just never bothered to ask `useAuth()` what the real state was.
 *
 * Now role-aware: signed out -> /login (unchanged); signed in -> the
 * role's own dashboard (/account, /provider, /admin) so the icon and the
 * actual session always agree, on every route, city included.
 */
const DASHBOARD_HREF_BY_ROLE: Record<Role, string> = {
  customer: "/account",
  provider: "/provider",
  admin: "/admin",
};

export function AccountButton({
  className,
  showLabel = false,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const { user } = useAuth();
  const href = user ? DASHBOARD_HREF_BY_ROLE[user.role] : "/login";
  const label = user ? "My Account" : "Account";

  return (
    <Link
      href={href}
      aria-label={showLabel ? undefined : label}
      title={showLabel ? undefined : label}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100",
        showLabel ? "gap-1.5 px-3 py-2 text-sm font-medium" : "h-9 w-9",
        className
      )}
    >
      <Icon name="user" className="h-5 w-5 shrink-0" />
      {showLabel && <span>{label}</span>}
    </Link>
  );
}
