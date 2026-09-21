import type { Product } from "@/types";
import { ProductCard } from "./ProductCard";

export function ProductGrid({ products, citySlug }: { products: Product[]; citySlug: string }) {
  if (products.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
        Not yet available in this city.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} citySlug={citySlug} />
      ))}
    </div>
  );
}
