import navData from "@/data/nav.json";
import type { NavItem } from "@/types";

/**
 * Nav reads for the marketplace footer (Phase 3 header/footer revision).
 * The old flat `primary`/`footer` site-map concept (Home / Services / Plans
 * / About / FAQ / Contact in one list) is gone — the global header no
 * longer carries a legacy nav at all (replaced by Location/Search/Cart/
 * Account), and the footer's link groups are split to match its Company/
 * Customer/Legal columns.
 *
 * As of the "FINAL UX + CART FUNCTIONALITY CORRECTION" pass, the mobile
 * hamburger (MobileMenu.tsx) no longer reads these — it's a primary-
 * navigation drawer with its own short, hardcoded route list (Home,
 * Services, My Orders, Login, About Us, Contact Us, FAQ), deliberately not
 * the footer's Company/Customer/Legal groups, so this file now backs only
 * the footer.
 */

/** Footer "Company" column — About Us / Contact Us / FAQ (the footer itself drops FAQ from this list as of the "FINAL HOMEPAGE / UX CORRECTION" pass — see Footer.tsx). */
export function getFooterCompanyNav(): NavItem[] {
  return navData.footerCompany as NavItem[];
}

/** Footer "Customer" column — account/orders/addresses/cart entry points. */
export function getFooterCustomerNav(): NavItem[] {
  return navData.footerCustomer as NavItem[];
}

export function getFooterLegalNav(): NavItem[] {
  return navData.footerLegal as NavItem[];
}
