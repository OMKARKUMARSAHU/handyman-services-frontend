import Link from "next/link";
import { Icon } from "@/lib/icons";
import { formatINR } from "@/lib/format";
import type { ShopProductSummary } from "@/lib/shop/types";
import { ShopAddToCartButton } from "./ShopAddToCartButton";
import { demoImageFor } from "./shopDemoImage";
import { displayName } from "./shopFormat";

/**
 * Compact product tile used inside the homepage service box. Same data, same cart button and same
 * detail link as `ShopProductCard`; only the density differs (image, name, price, Add to Cart).
 */
export function ShopProductTile({ product }: { product: ShopProductSummary }) {
  const name = displayName(product.name);
  const href = `/products/${product.slug}`;
  const image = product.primaryImage?.url ?? (product.isDemo ? demoImageFor(product.category.slug, product.name) : null);
  const cityBlocked = product.availableInCity === false;
  const sellable = product.inStock && !cityBlocked;
  return (
    <article className="flex h-full flex-col rounded-xl border border-neutral-100 bg-white p-2 text-left transition-colors hover:border-brand-200">
      <Link href={href} aria-label={`View ${name}`} className="block">
        <span className="flex h-20 items-center justify-center overflow-hidden rounded-lg bg-neutral-50">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- Media Library URL / bundled illustration
            <img src={image} alt={product.primaryImage?.altText || name} loading="lazy" className="h-full w-full object-contain p-1" />
          ) : (
            <Icon name="package" className="h-8 w-8 text-neutral-300" />
          )}
        </span>
        <span className="mt-2 line-clamp-2 block text-xs font-medium leading-tight text-neutral-800">{name}</span>
      </Link>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-sm font-bold text-neutral-900">{formatINR(product.price)}</span>
        {product.mrp ? <span className="text-[11px] text-neutral-400 line-through">{formatINR(product.mrp)}</span> : null}
      </p>
      {cityBlocked ? <p className="mt-0.5 text-[11px] font-medium text-red-700">Not available in your city</p> : null}
      <div className="mt-auto pt-2">
        <ShopAddToCartButton
          compact
          productId={product.id}
          inStock={sellable}
          unavailableLabel={cityBlocked ? "Unavailable" : undefined}
          maxQuantity={product.stockStatus === "out_of_stock" ? 0 : 20}
        />
      </div>
    </article>
  );
}
