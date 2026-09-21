import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { AccountPreAuth } from "@/components/account/AccountPreAuth";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your Handyman Services account.",
};

/**
 * UI shell only (PHASE_2_UI_UX_DESIGN.md §11) — the login method (OTP,
 * password, or social) is [TBD], Phase 1 §19. This is an honest
 * "not yet available" state, not a fake sign-in form, so it can accommodate
 * whichever method is confirmed later without a structural redesign.
 *
 * "FINAL UX + CART FUNCTIONALITY CORRECTION" (item 5/6): simplified from a
 * paragraph-plus-two-buttons layout to the client's exact suggested
 * structure — heading, one honest line, one button — and the "Call us" /
 * "Chat on WhatsApp" block is removed entirely. Those duplicated contact
 * CTAs that belong to the global floating WhatsApp button (see
 * WhatsAppButton.tsx), not an account-access page; keeping them here read
 * as "can't log in? call us instead", which isn't the message this page
 * should send. The floating WhatsApp button is unaffected and still
 * reachable from every page, including this one.
 */
export default function LoginPage() {
  return (
    <>
      <PageHeader heading="Login" subheading="Account sign-in isn't turned on yet." />
      <section className="py-14">
        <Container className="max-w-md">
          <AccountPreAuth message="You can still browse, add to cart and book as a guest — the login method (OTP, password, or social) hasn't been decided yet." />
        </Container>
      </section>
    </>
  );
}
