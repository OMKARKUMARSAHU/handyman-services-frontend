"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/state/AuthProvider";
import type { Role } from "@/lib/auth/types";

/**
 * Honest, auth-gated placeholder for the Provider/Admin panels — matching
 * this project's established pattern (see AccountPreAuth.tsx) of never
 * showing fake functionality. This phase is authentication/authorization
 * ONLY (catalog/listing/order management are explicitly out of scope), so
 * what exists here is: a real protected route, a real signed-in identity
 * read from the verified session, and a real logout — not a dashboard.
 *
 * The route is already guarded by `src/proxy.ts` (redirects an unauthenticated
 * or wrong-role request before this component ever renders), but this
 * client-side check still runs too — proxy.ts only decodes the token's
 * claims without verifying its signature, so this is a second, independent
 * check against the real `GET /me` (which DOES go through full server-side
 * verification) for the case the cookie is present but invalid/expired by
 * the time this page mounts.
 */
export function StaffPanelShell({ expectedRole, title }: { expectedRole: Role; title: string }) {
  const router = useRouter();
  const { user, status, logout } = useAuth();

  if (status === "loading") {
    return (
      <section className="py-14">
        <Container className="max-w-md text-center text-sm text-neutral-500">Checking your session…</Container>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="py-14">
        <Container className="max-w-md text-center">
          <p className="text-sm text-neutral-600">Your session has expired.</p>
          <Button href="/staff/login" className="mt-4">
            Log in
          </Button>
        </Container>
      </section>
    );
  }

  if (user.role !== expectedRole) {
    return (
      <section className="py-14">
        <Container className="max-w-md text-center">
          <p className="text-sm text-neutral-600">
            This account ({user.email ?? user.name}) does not have {expectedRole} access.
          </p>
          <Button href="/staff/login" className="mt-4">
            Sign in with a different account
          </Button>
        </Container>
      </section>
    );
  }

  return (
    <>
      <PageHeader heading={title} subheading={`Signed in as ${user.name}${user.email ? ` (${user.email})` : ""}.`} />
      <section className="py-14">
        <Container className="max-w-md">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-8 text-center">
            <p className="text-sm text-neutral-600">
              Authentication and role-based access for this panel are live. Listing/order/content management
              screens haven&rsquo;t been built yet — this phase was authentication and authorization only.
            </p>
            <Button
              variant="outline"
              className="mt-5"
              onClick={async () => {
                await logout();
                router.push("/staff/login");
              }}
            >
              Log out
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
}
