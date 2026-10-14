"use client";

import { useShopCity } from "@/lib/shop/useShopCity";

/** One line telling the visitor which city's prices/availability they are seeing, with a way to change it. */
export function ShopCityNotice({ className = "" }: { className?: string }) {
  const { citySlug, cityName, chooseCity } = useShopCity();
  return (
    <p className={`text-sm text-neutral-600 ${className}`}>
      {citySlug ? (
        <>
          Showing prices and availability for <strong className="text-neutral-900">{cityName}</strong>.{" "}
        </>
      ) : (
        <>Select your city to see exact prices and availability. </>
      )}
      <button type="button" onClick={chooseCity} className="font-semibold text-brand-700 hover:underline">
        {citySlug ? "Change city" : "Select city"}
      </button>
    </p>
  );
}
