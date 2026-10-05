import { redirect } from "next/navigation";

/**
 * MASTER TASK Bug 3: "My Orders" now lives inside the real Customer
 * Dashboard at `/account` (the Orders tab), wired to the actual
 * `/customer/orders` endpoint — this route is no longer an honest "not
 * available yet" stub pointing at nothing, so it redirects into the
 * dashboard instead of showing stale placeholder copy. The MobileMenu link
 * that points here keeps working unchanged.
 */
export default function AccountOrdersPage() {
  redirect("/account");
}
