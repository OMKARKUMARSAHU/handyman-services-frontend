/**
 * Pure rules for "which city's data may the UI show right now?".
 *
 * City-dependent blocks (the shop Products grid, the homepage service rails) start from whatever the
 * server rendered and then load the visitor's city in the browser. The bugs this module prevents:
 *  - showing the PREVIOUS city's (or the no-city base) results while a new city is still loading;
 *  - silently treating a failed request as "zero products";
 *  - an old, slower response overwriting the newly selected city's results.
 *
 * Everything is keyed by a city key (`slug`, or BASE_KEY for "no city chosen"), and a result is only ever
 * shown for exactly the key it was fetched for.
 */

/** Key used for "no city chosen" (base-price, unfiltered browsing). */
export const BASE_KEY = "__base__";

export function cityKey(citySlug: string | null | undefined): string {
  return citySlug ? citySlug : BASE_KEY;
}

export type FetchErrorKind =
  /** Network error or 5xx: worth a retry. */
  | "failed"
  /** HTTP 429: the rate limit was hit; retry shortly. */
  | "rate_limited"
  /** The backend does not know / no longer serves this city (HTTP 400/404). */
  | "city_unavailable";

export type CityFetchState<T> =
  | { key: string; status: "ok"; data: T }
  | { key: string; status: "error"; kind: FetchErrorKind }
  | null;

export type CityView<T> =
  /** Show what the server rendered (it is for exactly this city key). */
  | { kind: "initial" }
  /** The data for this city is on its way: show a placeholder, never another city's data. */
  | { kind: "loading" }
  | { kind: "ready"; data: T }
  | { kind: "error"; error: FetchErrorKind };

/**
 * Decides what to render.
 * - `initialKey`: the city key the server-rendered payload belongs to (BASE_KEY for the city-agnostic homepage).
 * - `initialOk`: whether the server render actually succeeded (a failed server fetch is NOT an empty result).
 */
export function pickCityView<T>(args: {
  citySlug: string | null | undefined;
  initialCity: string | null | undefined;
  initialOk: boolean;
  fetched: CityFetchState<T>;
}): CityView<T> {
  const key = cityKey(args.citySlug);
  const { fetched } = args;
  if (fetched && fetched.key === key) {
    return fetched.status === "ok" ? { kind: "ready", data: fetched.data } : { kind: "error", error: fetched.kind };
  }
  if (args.initialOk && cityKey(args.initialCity) === key) return { kind: "initial" };
  return { kind: "loading" };
}

/** Whether the browser still has to fetch this city's data (the server render does not already cover it). */
export function needsFetch(args: { citySlug: string | null | undefined; initialCity: string | null | undefined; initialOk: boolean }): boolean {
  return !(args.initialOk && cityKey(args.initialCity) === cityKey(args.citySlug));
}

/** Maps an HTTP status from the API/proxy to an error kind. */
export function classifyHttpStatus(status: number): FetchErrorKind {
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 404) return "city_unavailable";
  return "failed";
}
