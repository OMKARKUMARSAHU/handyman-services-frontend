import navData from "@/data/nav.json";
import type { NavItem } from "@/types";

/** Header + mobile-menu navigation — kept short by design (Home/Services/Plans/Contact). */
export function getPrimaryNav(): NavItem[] {
  return navData.primary as NavItem[];
}

/** Full site map used in the footer's "Navigate" column (includes About/FAQ). */
export function getFooterNav(): NavItem[] {
  return navData.footer as NavItem[];
}

export function getFooterLegalNav(): NavItem[] {
  return navData.footerLegal as NavItem[];
}
