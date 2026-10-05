import { redirect } from "next/navigation";

/**
 * MASTER TASK Bug 3: "Saved Addresses" now lives inside the real Customer
 * Dashboard at `/account` (the Saved Addresses tab), wired to the actual
 * `/customer/addresses` endpoint — this route is no longer an honest "not
 * available yet" stub, so it redirects into the dashboard instead of
 * showing stale placeholder copy.
 */
export default function AccountAddressesPage() {
  redirect("/account");
}
