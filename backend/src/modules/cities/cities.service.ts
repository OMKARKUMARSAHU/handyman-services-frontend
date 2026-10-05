import { randomUUID } from "node:crypto";
import { getDb } from "../../database/db";
import { NotFoundError } from "../../shared/errors";
import { type CityDto, type CityRow, toCityDto } from "./cities.types";

const TABLE = "cities";

export async function listCities(opts: { popularOnly?: boolean } = {}): Promise<CityDto[]> {
  const db = getDb();
  let query = db<CityRow>(TABLE).where({ active: true });
  if (opts.popularOnly) query = query.andWhere({ is_popular: true });
  const rows = await query.orderBy("sort_order", "asc");
  return rows.map(toCityDto);
}

export async function getCityBySlug(slug: string): Promise<CityDto | null> {
  const row = await getDb()<CityRow>(TABLE).where({ slug }).first();
  return row ? toCityDto(row) : null;
}

export async function getCityById(id: string): Promise<CityDto | null> {
  const row = await getDb()<CityRow>(TABLE).where({ id }).first();
  return row ? toCityDto(row) : null;
}

export interface UpsertCityInput {
  name: string;
  state: string;
  slug: string;
  isPopular?: boolean;
  active?: boolean;
  sortOrder?: number;
  iconUrl?: string | null;
  iconAlt?: string | null;
}

export async function createCity(input: UpsertCityInput): Promise<CityDto> {
  const id = randomUUID();
  await getDb()<CityRow>(TABLE).insert({
    id,
    name: input.name,
    state: input.state,
    slug: input.slug,
    is_popular: input.isPopular ?? false,
    active: input.active ?? true,
    sort_order: input.sortOrder ?? 0,
    icon_url: input.iconUrl ?? null,
    icon_alt: input.iconAlt ?? null,
  });
  const created = await getCityById(id);
  if (!created) throw new Error("Failed to read back created city.");
  return created;
}

export async function updateCity(id: string, input: Partial<UpsertCityInput>): Promise<CityDto> {
  const existing = await getCityById(id);
  if (!existing) throw new NotFoundError("City not found.");

  const patch: Partial<CityRow> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.state !== undefined) patch.state = input.state;
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.isPopular !== undefined) patch.is_popular = input.isPopular;
  if (input.active !== undefined) patch.active = input.active;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  if (input.iconUrl !== undefined) patch.icon_url = input.iconUrl;
  if (input.iconAlt !== undefined) patch.icon_alt = input.iconAlt;

  if (Object.keys(patch).length > 0) {
    await getDb()<CityRow>(TABLE).where({ id }).update(patch);
  }
  const updated = await getCityById(id);
  if (!updated) throw new Error("Failed to read back updated city.");
  return updated;
}
