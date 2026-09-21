import Link from "next/link";
import type { Product } from "@/types";
import { Icon } from "@/lib/icons";

export function ProductCard({ product, citySlug }: { product: Product; citySlug: string }) {
  return (
    <Link
      href={`/${citySlug}/${product.categoryId}/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:border-brand-300 hover:shadow-md"
    >
      {product.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- business photo, optimized separately later
        <img
          src={product.image}
          alt={`${product.name} service`}
          className="aspect-[4/3] w-full object-cover"
        />
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 text-brand-500 transition-colors group-hover:from-brand-100 group-hover:to-brand-200">
          <Icon name={product.icon} className="h-10 w-10" />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-sm font-bold text-neutral-900">{product.name}</h3>
        <p className="mt-1 line-clamp-2 text-xs text-neutral-600">{product.description}</p>
      </div>
    </Link>
  );
}
