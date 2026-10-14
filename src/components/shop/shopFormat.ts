import type { ShopStockStatus } from "@/lib/shop/types";

export function stockLabel(status: ShopStockStatus): { text: string; className: string } {
  switch (status) {
    case "in_stock":
      return { text: "In stock", className: "text-green-700" };
    case "low_stock":
      return { text: "Low stock — order soon", className: "text-amber-700" };
    default:
      return { text: "Out of stock", className: "text-red-700" };
  }
}

/** Serialises JSON-LD safely for an inline <script> (no `</script>` breakout from admin-entered text). */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

// ---- Customer-facing display clean-up for legacy placeholder catalogue data -------------------------
// Stored data is never changed here. Older sample records may still carry a "(Demo)" name suffix, a
// "Demo listing …" sentence or a DEMO-… SKU (see backend/scripts/sql/clean-demo-product-names.*.sql for
// the reviewed, reversible clean-up). Until that has been applied these helpers keep such text from
// reaching customers; once the data is clean they simply return the values unchanged.

/** "Refrigerator (Demo)" -> "Refrigerator". */
export function displayName(name: string): string {
  return name.replace(/\s*\((?:demo)(?: category)?\)/gi, "").trim() || name;
}

/** Customer-facing copy: hides placeholder sentences entirely, strips "(Demo category)". Returns null when nothing should be shown. */
export function displayText(text: string | null | undefined): string | null {
  if (!text) return null;
  if (/\bdemo (?:listing|data)\b|\bthis is demo\b/i.test(text)) return null;
  const cleaned = text.replace(/\s*\((?:demo)(?: category)?\)/gi, "").trim();
  return cleaned || null;
}

/** Placeholder SKUs ("DEMO-WM-001") are internal; real SKUs are shown. */
export function displaySku(sku: string | null | undefined): string | null {
  return sku && !/^demo[-_]/i.test(sku) ? sku : null;
}
