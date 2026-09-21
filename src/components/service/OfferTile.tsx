import type { Offer } from "@/types";
import { Icon } from "@/lib/icons";

/**
 * Informational only. Whether an applicable Offer stacks with, replaces, or
 * otherwise interacts with the Service.offerPrice-derived discount shown in
 * <ServicePriceBlock /> is [TBD] — PHASE_2_DATA_ARCHITECTURE.md §3 (Offer),
 * PHASE_2_OPEN_QUESTIONS.md #25. This component never adjusts, recalculates,
 * or combines the price above; it only surfaces the offer's own text.
 */
export function OfferTile({ offers }: { offers: Offer[] }) {
  if (offers.length === 0) return null;
  return (
    <div className="space-y-2">
      {offers.map((offer) => (
        <div
          key={offer.id}
          className="flex items-start gap-3 rounded-xl border border-accent-500/60 bg-accent-500/10 p-3"
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-500 text-neutral-900">
            <Icon name="badge-check" className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-neutral-900">{offer.title}</p>
            <p className="text-xs text-neutral-600">{offer.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
