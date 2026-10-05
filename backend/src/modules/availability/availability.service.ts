import { randomUUID } from "node:crypto";
import { getDb } from "../../database/db";

/**
 * service_city_availability — PHASE_2_BACKEND_DATABASE_SCHEMA.md §11.
 * A service is never duplicated per city; this is the join table Admin
 * bulk-updates to control where a given service is offered.
 */
export interface CityAvailabilityDto {
  cityId: string;
  active: boolean;
}

export async function setServiceCityAvailability(
  serviceId: string,
  entries: { cityId: string; active: boolean }[]
): Promise<CityAvailabilityDto[]> {
  const db = getDb();
  await db.transaction(async (trx) => {
    for (const entry of entries) {
      const existing = await trx("service_city_availability")
        .where({ service_id: serviceId, city_id: entry.cityId })
        .first();
      if (existing) {
        await trx("service_city_availability")
          .where({ service_id: serviceId, city_id: entry.cityId })
          .update({ active: entry.active });
      } else {
        await trx("service_city_availability").insert({
          id: randomUUID(),
          service_id: serviceId,
          city_id: entry.cityId,
          active: entry.active,
        });
      }
    }
  });

  const rows = await db<{ service_id: string; city_id: string; active: number | boolean }>(
    "service_city_availability"
  ).where({ service_id: serviceId });
  return rows.map((r) => ({ cityId: r.city_id, active: Boolean(r.active) }));
}
