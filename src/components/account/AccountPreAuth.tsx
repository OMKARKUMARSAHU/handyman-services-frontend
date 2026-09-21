import Link from "next/link";
import { Icon } from "@/lib/icons";

/**
 * Shared "not logged in yet" screen — replaces `AccountShell.tsx`'s 3-tab
 * Profile/Orders/Addresses side nav in the "FINAL UX + CART FUNCTIONALITY
 * CORRECTION" pass.
 *
 * The client's own words for what the old shell had become: "a fake logged-
 * in dashboard" — "My Account, Addresses, Orders dashboard, Saved
 * addresses, Account settings...". None of that exists here anymore. This
 * is one focused card — a person icon, one honest sentence, one button —
 * used by `/account`, `/account/orders`, and `/account/addresses` (each
 * with its own contextual `message`) and, with a slightly different
 * button, by `/login` itself.
 *
 * `ctaHref`, when given, renders the button as a real `Link` to that route
 * (every account stub points it at `/login`, the site's one real account
 * entry point — never a fake destination). Omitted (as `/login` itself
 * does, since that page already *is* the destination), the button renders
 * as a plain, keyboard-focusable `<button>` with no handler — an honest
 * placeholder for a login flow that isn't built yet, never a fake success
 * state, matching this project's established pattern for TBD auth
 * (PHASE_1_NEW_REQUIREMENTS_ANALYSIS.md §19).
 */
export function AccountPreAuth({
  message,
  ctaHref,
}: {
  message: string;
  ctaHref?: string;
}) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-neutral-200 bg-neutral-50 p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-neutral-200 text-neutral-500">
        <Icon name="user" className="h-7 w-7" />
      </div>
      <p className="mt-4 text-sm text-neutral-600">{message}</p>
      {ctaHref ? (
        <Link
          href={ctaHref}
          className="mt-5 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Log in or sign up
        </Link>
      ) : (
        <button
          type="button"
          className="mt-5 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Log in or sign up
        </button>
      )}
    </div>
  );
}
