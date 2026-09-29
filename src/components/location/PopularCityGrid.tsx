import type { City } from "@/types";
import { LocationIcon } from "./LocationIcon";

/**
 * Popular-city cards now lead with a landmark icon (LOCATION SELECTOR —
 * LANDMARK ICON SYSTEM phase) instead of being text-only — the icon is the
 * primary recognition element, the city name stays clearly readable
 * underneath. Each city's visual comes entirely from `city.iconUrl` via
 * LocationIcon, which already handles the "no icon yet" fallback — this
 * component never imports a specific city's image itself.
 *
 * Landmark Artwork Revision: bumped from `h-11 w-11` (44px) to `h-16 w-16`
 * (64px) — within the client's requested ~48–80px range for Popular Cities
 * — so the now-recognizable landmark illustrations (rather than the
 * previous generic glyphs) read clearly as the card's primary visual, not
 * a small accent.
 */
export function PopularCityGrid({
  cities,
  onSelect,
}: {
  cities: City[];
  onSelect: (citySlug: string) => void;
}) {
  if (cities.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Popular Cities
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {cities.map((city) => (
          <button
            key={city.id}
            type="button"
            onClick={() => onSelect(city.slug)}
            aria-label={`Select ${city.name}, ${city.state}`}
            className="flex flex-col items-center gap-1.5 rounded-lg border border-neutral-200 px-2 py-3 text-center hover:border-brand-400 hover:bg-brand-50"
          >
            <LocationIcon iconUrl={city.iconUrl} iconAlt={city.iconAlt} className="h-16 w-16" />
            <span className="line-clamp-1 text-xs font-medium text-neutral-800">{city.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
