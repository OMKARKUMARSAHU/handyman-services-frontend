import type { City } from "@/types";

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
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        Popular Cities
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {cities.map((city) => (
          <button
            key={city.id}
            type="button"
            onClick={() => onSelect(city.slug)}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-left text-sm font-medium text-neutral-800 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
          >
            {city.name}
          </button>
        ))}
      </div>
    </div>
  );
}
