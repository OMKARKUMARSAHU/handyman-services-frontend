import offersData from "@/data/offers.json";
import type { Offer } from "@/types";
import { getServiceByIdSync } from "./services";
import { getAllProductsSync } from "./products";

export async function getOffers(opts?: {
  cityId?: string;
  serviceId?: string;
  categoryId?: string;
}): Promise<Offer[]> {
  let offers = (offersData as Offer[]).filter((o) => o.active);

  if (opts?.serviceId) {
    const serviceId = opts.serviceId;
    offers = offers.filter(
      (o) =>
        o.appliesTo.scope === "all" ||
        (o.appliesTo.scope === "service" && o.appliesTo.ids.includes(serviceId))
    );
  } else if (opts?.categoryId) {
    const categoryId = opts.categoryId;
    offers = offers.filter(
      (o) =>
        o.appliesTo.scope === "all" ||
        (o.appliesTo.scope === "category" && o.appliesTo.ids.includes(categoryId))
    );
  }
  // opts.cityId is accepted for signature-compatibility with a future
  // city-scoped Offer model, but no Offer record is city-scoped today.
  return offers;
}

/** Offers applicable to one specific service (its own id, or its product's category). Informational display only — see lib/pricing.ts for why this is never combined into the price. */
export function getOffersForServiceSync(serviceId: string): Offer[] {
  const service = getServiceByIdSync(serviceId);
  const product = service ? getAllProductsSync().find((p) => p.id === service.productId) : undefined;
  const offers = (offersData as Offer[]).filter((o) => o.active);
  return offers.filter((o) => {
    if (o.appliesTo.scope === "all") return true;
    if (o.appliesTo.scope === "service") return o.appliesTo.ids.includes(serviceId);
    if (o.appliesTo.scope === "category" && product) {
      return o.appliesTo.ids.includes(product.categoryId);
    }
    return false;
  });
}
