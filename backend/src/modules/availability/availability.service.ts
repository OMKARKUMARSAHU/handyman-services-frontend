import { randomUUID } from "node:crypto";
import { getDb } from "../../database/db";
import { NotFoundError, ValidationError } from "../../shared/errors";

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

export interface CityPriceEntry {
  cityId: string;
  /** null together with `offerPrice: null` = clear the custom price (use base prices). */
  mrp: number | null;
  offerPrice: number | null;
}

export interface CityPriceDto {
  cityId: string;
  mrp: number;
  offerPrice: number;
}

/**
 * Saves per-city custom MRP/offer price for a service into the same
 * `service_city_availability` row that already holds that city's availability.
 *
 * Pricing never changes availability: an existing row keeps its `active`
 * value, and a row created here (the city had no availability row yet) is
 * inserted with `active = false`, so configuring a price can never make a
 * service appear in a city where the Admin has not enabled it. Entries with
 * both prices null clear the custom price. Returns every city that now has a
 * custom price for the service.
 */
export async function setServiceCityPricing(serviceId: string, entries: CityPriceEntry[]): Promise<CityPriceDto[]> {
  const db = getDb();
  const service = await db("services").where({ id: serviceId }).first("id");
  if (!service) throw new NotFoundError("Service not found.");

  // Defensive re-check (the route schema already enforces this) so no caller of this function can store an invalid pair.
  for (const e of entries) {
    if ((e.mrp === null) !== (e.offerPrice === null)) {
      throw new ValidationError("Enter both MRP and offer price for a city, or leave both empty.");
    }
    if (e.mrp !== null && e.offerPrice !== null && (e.mrp < 0 || e.offerPrice < 0 || e.offerPrice > e.mrp)) {
      throw new ValidationError("City prices must be non-negative and the offer price cannot exceed the MRP.");
    }
  }

  const cityIds = entries.map((e) => e.cityId);
  const knownCities = await db<{ id: string }>("cities").whereIn("id", cityIds).select("id");
  if (knownCities.length !== new Set(cityIds).size) throw new NotFoundError("One or more cities do not exist.");

  await db.transaction(async (trx) => {
    for (const entry of entries) {
      const existing = await trx("service_city_availability")
        .where({ service_id: serviceId, city_id: entry.cityId })
        .first("id");
      if (existing) {
        await trx("service_city_availability")
          .where({ service_id: serviceId, city_id: entry.cityId })
          .update({ mrp: entry.mrp, offer_price: entry.offerPrice });
      } else if (entry.mrp !== null) {
        await trx("service_city_availability").insert({
          id: randomUUID(),
          service_id: serviceId,
          city_id: entry.cityId,
          active: false, // pricing alone must never make a service available in a city
          mrp: entry.mrp,
          offer_price: entry.offerPrice,
        });
      }
    }
  });

  const rows = await db<{ service_id: string; city_id: string; mrp: string | null; offer_price: string | null }>("service_city_availability")
    .where({ service_id: serviceId })
    .whereNotNull("mrp")
    .whereNotNull("offer_price");
  return rows.map((r) => ({ cityId: r.city_id, mrp: Number(r.mrp), offerPrice: Number(r.offer_price) }));
}
