import type { City } from "@/types";
import { LocationIcon } from "./LocationIcon";

/**
 * "Other Cities" rows use the same icon system as PopularCityGrid (LOCATION
 * SELECTOR — LANDMARK ICON SYSTEM phase) — a smaller icon in a horizontal
 * row, since this list is expected to hold more cities than the popular
 * grid and needs to stay scannable at any length without breaking layout.
 *
 * Landmark Artwork Revision: bumped from `h-7 w-7` (28px) to `h-9 w-9`
 * (36px) — still within the client's requested ~28–40px range for Other
 * Cities — so the now-detailed landmark silhouettes stay legible at list
 * size instead of shrinking to an indistinct smudge.
 */
export function CityList({
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
        Other Cities
      </p>
      <ul className="space-y-1">
        {cities.map((city) => (
          <li key={city.id}>
            <button
              type="button"
              onClick={() => onSelect(city.slug)}
              aria-label={`Select ${city.name}, ${city.state}`}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-neutral-800 hover:bg-brand-50 hover:text-brand-700"
            >
              <LocationIcon iconUrl={city.iconUrl} iconAlt={city.iconAlt} className="h-9 w-9" />
              <span className="min-w-0 flex-1 truncate">
                {city.name}
                <span className="ml-1.5 text-neutral-500">— {city.state}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
