"use client";

import { useCallback } from "react";
import { useLocation } from "@/lib/state/LocationProvider";

/**
 * The visitor's chosen city (the same one the header selector stores). Shop
 * prices and availability are city-wise, so every shop surface reads it from
 * here and passes only the SLUG to the backend, which does all the resolving.
 */
export function useShopCity() {
  const { lastCitySlug, openCitySelector, getCity } = useLocation();
  const cityName = lastCitySlug ? getCity(lastCitySlug)?.name ?? lastCitySlug : null;
  // A no-op callback keeps the visitor on the current page instead of the selector's default "/[city]" navigation.
  const chooseCity = useCallback(() => openCitySelector(() => {}), [openCitySelector]);
  return { citySlug: lastCitySlug, cityName, chooseCity };
}
