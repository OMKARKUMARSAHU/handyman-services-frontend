"use client";

import Link from "next/link";
import type { CartItem } from "@/types";
import { getServiceByIdSync } from "@/lib/data/services";
import { getCityBySlugSync } from "@/lib/data/cities";
import { formatINR } from "@/lib/format";
import { useCart } from "@/lib/state/CartProvider";
import { Icon } from "@/lib/icons";

export function CartLineItem({ item, compact = false }: { item: CartItem; compact?: boolean }) {
  const { updateCartItemQuantity, removeFromCart } = useCart();
  const service = getServiceByIdSync(item.serviceId);
  const city = getCityBySlugSync(item.cityId);

  if (!service) {
    // Data-driven mock catalog changed under an existing cart item — an honest
    // removed-service state rather than a broken render.
    return (
      <li className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 text-sm text-neutral-500">
        <span>This service is no longer available.</span>
        <button
          type="button"
          aria-label={`Remove item (no longer available) from cart`}
          onClick={() => removeFromCart(item.id)}
          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 hover:underline"
        >
          Remove
        </button>
      </li>
    );
  }

  const lineTotal = item.unitPriceAtAdd * item.quantity;
  const image = service.images[0]?.url ?? null;

  return (
    <li className="flex gap-3 rounded-lg border border-neutral-200 p-3">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- mock/placeholder gallery asset, not an optimized business photo
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-400">
            <Icon name="wrench" className="h-6 w-6" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <Link
          href={city ? `/${city.slug}/service/${service.slug}` : "#"}
          className="block truncate text-sm font-semibold text-neutral-900 hover:text-brand-700"
        >
          {service.name}
        </Link>
        {!compact && city && (
          <p className="mt-0.5 text-xs text-neutral-500">{city.name}</p>
        )}
        <p className="mt-1 text-sm font-semibold text-neutral-900">
          {formatINR(item.unitPriceAtAdd)}
          <span className="ml-1 text-xs font-normal text-neutral-500">
            × {item.quantity} = {formatINR(lineTotal)}
          </span>
        </p>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-neutral-300">
            <button
              type="button"
              aria-label={`Decrease quantity of ${service.name}`}
              onClick={() => updateCartItemQuantity(item.id, item.quantity - 1)}
              className="px-2.5 py-1 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
            >
              −
            </button>
            <span className="min-w-[1.5rem] px-1 text-center text-sm">{item.quantity}</span>
            <button
              type="button"
              aria-label={`Increase quantity of ${service.name}`}
              onClick={() => updateCartItemQuantity(item.id, item.quantity + 1)}
              className="px-2.5 py-1 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
            >
              +
            </button>
          </div>
          <button
            type="button"
            aria-label={`Remove ${service.name} from cart`}
            onClick={() => removeFromCart(item.id)}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 hover:underline"
          >
            <Icon name="x" className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}
