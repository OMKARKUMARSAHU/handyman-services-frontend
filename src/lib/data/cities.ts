import citiesData from "@/data/cities.json";
import type { City } from "@/types";

/**
 * City reads. No launch-city list has been confirmed by the client — this
 * mock set is illustrative content only (PHASE_1_NEW_REQUIREMENTS_ANALYSIS.md
 * §43, PHASE_2_OPEN_QUESTIONS.md #13). Written as `async` from the start per
 * PHASE_2_API_CONTRACT.md §1, even though the mock resolves synchronously.
 */
export async function getCities(): Promise<City[]> {
  return [...(citiesData as City[])]
    .filter((c) => c.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getCityBySlug(slug: string): Promise<City | null> {
  const city = (citiesData as City[]).find((c) => c.slug === slug && c.active);
  return city ?? null;
}

export async function getPopularCities(): Promise<City[]> {
  const cities = await getCities();
  return cities.filter((c) => c.isPopular);
}

/** Synchronous variant used only by components/state that cannot await (e.g. static params, cart snapshot). Same data source, no separate seam. */
export function getCityBySlugSync(slug: string): City | undefined {
  return (citiesData as City[]).find((c) => c.slug === slug && c.active);
}

export function getAllCitiesSync(): City[] {
  return [...(citiesData as City[])].filter((c) => c.active).sort((a, b) => a.sortOrder - b.sortOrder);
}
