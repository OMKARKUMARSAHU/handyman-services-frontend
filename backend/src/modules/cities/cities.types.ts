/** API shape — matches the existing frontend's `City` type (src/types/index.ts) exactly. */
export interface CityDto {
  id: string;
  name: string;
  state: string;
  slug: string;
  isPopular: boolean;
  active: boolean;
  sortOrder: number;
  iconUrl: string | null;
  iconAlt: string | null;
}

export interface CityRow {
  id: string;
  name: string;
  state: string;
  slug: string;
  is_popular: number | boolean;
  active: number | boolean;
  sort_order: number;
  icon_url: string | null;
  icon_alt: string | null;
}

export function toCityDto(row: CityRow): CityDto {
  return {
    id: row.id,
    name: row.name,
    state: row.state,
    slug: row.slug,
    isPopular: Boolean(row.is_popular),
    active: Boolean(row.active),
    sortOrder: row.sort_order,
    iconUrl: row.icon_url,
    iconAlt: row.icon_alt,
  };
}
