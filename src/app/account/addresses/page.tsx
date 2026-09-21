import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { AccountPreAuth } from "@/components/account/AccountPreAuth";

export const metadata: Metadata = { title: "My Addresses" };

/**
 * "FINAL UX + CART FUNCTIONALITY CORRECTION" (item 4): dropped the shared
 * `AccountShell` tab bar, same as `/account` and `/account/orders`. Not
 * part of the primary navigation surface (hamburger/footer) — reachable by
 * direct URL only, same as `/account` itself.
 */
export default function AccountAddressesPage() {
  return (
    <>
      <PageHeader heading="My Addresses" />
      <section className="py-10 sm:py-14">
        <Container>
          <AccountPreAuth
            message="Log in to view and manage your saved addresses. You can also enter an address directly during checkout."
            ctaHref="/login"
          />
        </Container>
      </section>
    </>
  );
}
