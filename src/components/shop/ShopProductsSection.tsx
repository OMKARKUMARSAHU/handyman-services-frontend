import Link from "next/link";
import { Icon } from "@/lib/icons";
import { getShopProductsLive } from "@/lib/shop/api";
import { ShopProductGrid } from "./ShopProductGrid";

const HOME_QUERY = { featured: true, sort: "oldest", pageSize: 3 } as const;

/**
 * "PRODUCTS" block rendered INSIDE the existing homepage service box (the white card under
 * "What do you need serviced?") — it is passed to `Hero` as `panelFooter`, so the hero, its photo
 * collage and the service tiles are untouched. Shows the products an admin marked "Featured" (3 slots,
 * from the real Shop API: real prices, stock and city availability) plus an "All Products" tile.
 * Renders nothing in production if there are no featured products or the backend is unreachable, so the
 * homepage can never break; in development it explains why it is empty.
 */
export async function ShopProductsSection() {
  const result = await getShopProductsLive({ ...HOME_QUERY });
  if (!result.ok || result.items.length === 0) {
    if (process.env.NODE_ENV === "production") return null;
    return (
      <div role="note" className="mt-4 rounded-xl border border-dashed border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <strong>Products (development notice):</strong>{" "}
        {result.ok
          ? "no featured products yet. In Admin → Shop → Settings choose “Load demo data”, or tick “Featured” on up to 3 products. (Not shown in production.)"
          : "the products API did not answer successfully. Check that the backend is running and that its database has migrations 20 and 21 applied (npm run db:check in backend); the Next.js terminal shows the exact reason. (Not shown in production.)"}
      </div>
    );
  }
  return (
    <div className="mt-3 border-t border-neutral-100 pt-3" aria-labelledby="home-products-heading">
      <h2 id="home-products-heading" className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Products
      </h2>
      <p className="mt-1 px-1 text-xs text-neutral-500">Filters, spares and accessories for your home appliances.</p>
      <ShopProductGrid
        variant="tile"
        initialItems={result.items}
        initialMeta={result.meta}
        query={{ ...HOME_QUERY }}
        gridClassName="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4"
        trailing={
          <Link
            href="/products"
            className="group flex h-full min-h-28 flex-col items-center justify-center gap-2 rounded-xl border border-neutral-100 bg-brand-50/50 px-2 py-3 text-center transition-colors hover:border-brand-200 hover:bg-brand-50"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-600 ring-1 ring-neutral-100">
              <Icon name="layout-grid" className="h-5 w-5" />
            </span>
            <span className="text-xs font-semibold text-brand-700">All Products</span>
            <span aria-hidden="true" className="text-base leading-none text-brand-700 transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        }
      />
    </div>
  );
}
