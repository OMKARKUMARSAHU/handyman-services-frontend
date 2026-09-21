import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { AccountPreAuth } from "@/components/account/AccountPreAuth";

export const metadata: Metadata = { title: "Profile" };

/**
 * "FINAL UX + CART FUNCTIONALITY CORRECTION" (item 4): this used to be the
 * root of a 3-tab `AccountShell` (Profile/Orders/Addresses side nav) — the
 * client's explicit complaint was that this reads as "a fake logged-in
 * dashboard" when no real authentication exists. Simplified to the client's
 * own suggested content for this exact screen: a "Profile" heading and one
 * "Log in or sign up" action — nothing else. Nothing links to `/account`
 * directly (the header's Account icon and the hamburger both point at
 * `/login`, the site's one real account entry point), so this route stays
 * reachable but isn't part of the primary navigation surface.
 */
export default function AccountPage() {
  return (
    <>
      <PageHeader heading="Profile" />
      <section className="py-10 sm:py-14">
        <Container>
          <AccountPreAuth
            message="You're not logged in yet — account sign-in hasn't been built."
            ctaHref="/login"
          />
        </Container>
      </section>
    </>
  );
}
