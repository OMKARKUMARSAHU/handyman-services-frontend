import type { Service } from "@/types";
import { formatINR } from "@/lib/format";

/**
 * Displays only the mrp/offerPrice-derived discount (lib/pricing.ts). Any
 * applicable Offer is shown separately by <OfferTile /> — see that
 * component's comment for why the two are never combined here.
 */
export function ServicePriceBlock({ service }: { service: Service }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="text-2xl font-extrabold text-neutral-900">{formatINR(service.offerPrice)}</span>
      {service.discountPercent > 0 && (
        <>
          <span className="text-base text-neutral-500 line-through">{formatINR(service.mrp)}</span>
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-800">
            {service.discountPercent}% off
          </span>
        </>
      )}
    </div>
  );
}
