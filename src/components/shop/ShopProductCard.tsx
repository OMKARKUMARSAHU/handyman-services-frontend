import Link from "next/link";
import { Icon } from "@/lib/icons";
import { formatINR } from "@/lib/format";
import type { ShopProductSummary } from "@/lib/shop/types";
import { ShopAddToCartButton } from "./ShopAddToCartButton";
import { displayName, displayText, stockLabel } from "./shopFormat";
import { demoImageFor } from "./shopDemoImage";

/** Product card for the listing grid: image, name, price, optional MRP/discount, stock status, Add to Cart, detail link. */
export function ShopProductCard({ product }: { product: ShopProductSummary }) {
  const stock = stockLabel(product.stockStatus);
  const href = `/products/${product.slug}`;
  const name = displayName(product.name);
  const shortText = displayText(product.shortDescription);
  const image = product.primaryImage ?? (product.isDemo ? fallbackImage(product) : null);
  const cityBlocked = product.availableInCity === false;
  const sellable = product.inStock && !cityBlocked;
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <Link href={href} className="relative block aspect-square overflow-hidden bg-neutral-100" aria-label={`View ${name}`}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- Media Library URL served through the same-origin proxy
          <img
            src={image.url}
            alt={image.altText || name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-neutral-300">
            <Icon name="package" className="h-12 w-12" />
          </span>
        )}
        <span className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {product.discountPercent ? (
            <span className="rounded-full bg-green-600 px-2 py-0.5 text-xs font-bold text-white">{product.discountPercent}% off</span>
          ) : null}
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{product.category.name}</p>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-neutral-900">
          <Link href={href} className="hover:text-brand-700">
            {name}
          </Link>
        </h3>
        {shortText && <p className="line-clamp-2 text-xs text-neutral-500">{shortText}</p>}

        <div className="mt-auto pt-2">
          <p className="flex items-baseline gap-2">
            <span className="text-lg font-extrabold text-neutral-900">{formatINR(product.price)}</span>
            {product.mrp ? <span className="text-sm text-neutral-400 line-through">{formatINR(product.mrp)}</span> : null}
          </p>
          <p className={`mt-0.5 text-xs font-medium ${cityBlocked ? "text-red-700" : stock.className}`}>{cityBlocked ? "Not available in your city" : stock.text}</p>
        </div>

        <ShopAddToCartButton productId={product.id} inStock={sellable} unavailableLabel={cityBlocked ? "Not available in your city" : undefined} maxQuantity={product.stockStatus === "out_of_stock" ? 0 : 20} />
        <Link href={href} className="text-center text-xs font-semibold text-brand-700 hover:underline">
          View details
        </Link>
      </div>
    </article>
  );
}

function fallbackImage(product: ShopProductSummary): { url: string; altText: string | null } | null {
  const url = demoImageFor(product.category.slug, product.name);
  return url ? { url, altText: displayName(product.name) } : null;
}
