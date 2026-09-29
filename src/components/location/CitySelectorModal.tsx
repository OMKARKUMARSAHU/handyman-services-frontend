"use client";

import { useMemo, useState } from "react";
import { HeaderModal } from "@/components/layout/HeaderActionModal";
import { useLocation } from "@/lib/state/LocationProvider";
import { getAllCitiesSync } from "@/lib/data/cities";
import { CitySearchInput } from "./CitySearchInput";
import { PopularCityGrid } from "./PopularCityGrid";
import { CityList } from "./CityList";

/**
 * A single instance of this lives in the root layout, controlled entirely by
 * LocationProvider (PHASE_2_UI_UX_DESIGN.md §4) — any component can trigger
 * it via useLocation().openCitySelector(), not just the header's own button.
 */
export function CitySelectorModal() {
  const { citySelectorOpen, closeCitySelector, resolveCitySelection } = useLocation();
  const [query, setQuery] = useState("");

  const allCities = useMemo(() => getAllCitiesSync(), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allCities;
    // City-name match is the primary behavior (unchanged from before this
    // phase). A state-name match is layered on top — searching "Jharkhand"
    // additionally surfaces Ranchi/Jamshedpur — since the data layer already
    // carries `state` on every city; this is additive and never narrows what
    // a plain city-name search used to return.
    return allCities.filter(
      (c) => c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q)
    );
  }, [allCities, query]);

  const popular = filtered.filter((c) => c.isPopular);
  const others = filtered.filter((c) => !c.isPopular);

  function handleClose() {
    setQuery("");
    closeCitySelector();
  }

  function handleSelect(citySlug: string) {
    setQuery("");
    resolveCitySelection(citySlug);
  }

  return (
    <HeaderModal open={citySelectorOpen} onClose={handleClose} title="Select your city">
      <CitySearchInput value={query} onChange={setQuery} />
      <div className="mt-3 max-h-[26rem] space-y-4 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-neutral-500">
            No cities match &ldquo;{query}&rdquo;.
          </p>
        )}
        <PopularCityGrid cities={popular} onSelect={handleSelect} />
        <CityList cities={others} onSelect={handleSelect} />
      </div>
    </HeaderModal>
  );
}
