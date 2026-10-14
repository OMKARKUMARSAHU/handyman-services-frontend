import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { ShopCartLink } from "@/components/shop/ShopCartLink";
import { ShopFilters } from "@/components/shop/ShopFilters";
import { ShopCityNotice } from "@/components/shop/ShopCityNotice";
import { ShopProductGrid } from "@/components/shop/ShopProductGrid";
import { displayText } from "@/components/shop/shopFormat";
import { getShopCategoriesLive, getShopProductsLive } from "@/lib/shop/api";
import { SITE_URL } from "@/lib/seo/site";

type SearchParams = { category?: string; search?: string; sort?: string; inStock?: string; page?: string };
const PAGE_SIZE = 12;
const SORTS = ["newest", "price_asc", "price_desc"] as const;

function cleanSort(s?: string): (typeof SORTS)[number] {
  return (SORTS as readonly string[]).includes(s ?? "") ? (s as (typeof SORTS)[number]) : "newest";
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const sp = await searchParams;
  const categories = await getShopCategoriesLive();
  const cat = categories.find((c) => c.slug === sp.category);
  const title = cat ? cat.seoTitle || `${cat.name} — Products` : "Products";
  const description =
    cat?.seoDescription || displayText(cat?.description) || "Shop water purifier filters, AC and appliance accessories, cleaning and home-maintenance products from Handyman Services.";
  // Filtered / searched / paginated variants canonicalise to the category (or the root) so they don't compete in search results.
  const canonical = cat ? `/products?category=${cat.slug}` : "/products";
  const hasVariantParams = Boolean(sp.search || sp.sort || sp.inStock || (sp.page && sp.page !== "1"));
  return {
    title,
    description,
    alternates: { canonical },
    robots: hasVariantParams ? { index: false, follow: true } : undefined,
    openGraph: { type: "website", title, description, url: `${SITE_URL}${canonical}` },
  };
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const sort = cleanSort(sp.sort);
  const inStock = sp.inStock === "true";

  const [categories, result] = await Promise.all([
    getShopCategoriesLive(),
    getShopProductsLive({ category: sp.category, search: sp.search, sort, inStock, page, pageSize: PAGE_SIZE }),
  ]);
  const activeCategory = categories.find((c) => c.slug === sp.category);

  return (
    <>
      <PageHeader
        heading={activeCategory ? activeCategory.name : "Products"}
        subheading={displayText(activeCategory?.description) || "Filters, spares and accessories for water purifiers, ACs and your home."}
      />

      <section className="py-8 sm:py-10">
        <Container>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="Product categories" className="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 pb-1">
              <CategoryChip href="/products" active={!sp.category} label="All" />
              {categories.map((c) => (
                <CategoryChip key={c.id} href={`/products?category=${c.slug}`} active={c.slug === sp.category} label={c.name} count={c.productCount} />
              ))}
            </nav>
            <ShopCartLink />
          </div>

          <ShopCityNotice className="mb-3" />
          <ShopFilters category={sp.category} search={sp.search} sort={sort} inStock={inStock} />

          {result.ok && result.items.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-neutral-300 px-6 py-14 text-center">
              <p className="text-base font-semibold text-neutral-900">No products found</p>
              <p className="mt-1 text-sm text-neutral-500">
                {sp.search || sp.category || inStock ? "Try a different search or clear the filters." : "Products will appear here soon."}
              </p>
              {(sp.search || sp.category || inStock) && (
                <Link href="/products" className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline">
                  Clear filters
                </Link>
              )}
            </div>
          ) : (
            <>
              <ShopProductGrid
                initialItems={result.items}
                initialMeta={result.meta}
                initialOk={result.ok}
                query={{ category: sp.category, search: sp.search, sort, inStock, page, pageSize: PAGE_SIZE }}
                paginationParams={{ category: sp.category, search: sp.search, sort: sort === "newest" ? undefined : sort, inStock: inStock ? "true" : undefined }}
                showCount
              />
            </>
          )}
        </Container>
      </section>
    </>
  );
}

function CategoryChip({ href, active, label, count }: { href: string; active: boolean; label: string; count?: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
        active ? "border-brand-600 bg-brand-600 text-white" : "border-neutral-300 bg-white text-neutral-700 hover:border-brand-500 hover:text-brand-700"
      }`}
    >
      {label}
      {typeof count === "number" ? <span className={`ml-1.5 text-xs ${active ? "text-white/80" : "text-neutral-400"}`}>{count}</span> : null}
    </Link>
  );
}
