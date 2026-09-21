import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { AccountPreAuth } from "@/components/account/AccountPreAuth";

export const metadata: Metadata = { title: "My Orders" };

/**
 * "FINAL UX + CART FUNCTIONALITY CORRECTION" (item 4): dropped the shared
 * `AccountShell` tab bar (Profile/Orders/Addresses side nav) in favor of a
 * single focused honest stub, same as `/account` and `/account/addresses`.
 * Reachable from the mobile hamburger's "My Orders" item (MobileMenu.tsx)
 * — a real, existing route, not an invented one.
 */
export default function AccountOrdersPage() {
  return (
    <>
      <PageHeader heading="My Orders" />
      <section className="py-10 sm:py-14">
        <Container>
          <AccountPreAuth
            message="Log in to view your order history. If you just placed a booking, use the confirmation link from that order instead."
            ctaHref="/login"
          />
        </Container>
      </section>
    </>
  );
}
