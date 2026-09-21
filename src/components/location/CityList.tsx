import type { City } from "@/types";

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
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        Other Cities
      </p>
      <ul className="space-y-1">
        {cities.map((city) => (
          <li key={city.id}>
            <button
              type="button"
              onClick={() => onSelect(city.slug)}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-neutral-800 hover:bg-brand-50 hover:text-brand-700"
            >
              {city.name}
              <span className="ml-1.5 text-neutral-400">— {city.state}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
