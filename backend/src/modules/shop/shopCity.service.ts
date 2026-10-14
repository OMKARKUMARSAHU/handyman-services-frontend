import { randomUUID } from "node:crypto";
import type { Knex } from "knex";
import { getDb } from "../../database/db";
import { NotFoundError, ValidationError } from "../../shared/errors";
import { roundMoney } from "../../shared/pricing";

/**
 * City-wise availability and pricing for shop products.
 *
 * Rules (the server is the only authority; the browser only sends a city slug):
 *  - No `shop_product_cities` row for (product, city)  => available at the base
 *    price, adjusted by the city's percentage (if any).
 *  - Row with `available = false`                       => not sold in that city.
 *  - Row with `price_override`                          => that exact price in
 *    that city (the city percentage is NOT applied on top).
 *  - No city supplied                                   => browsing at base price
 *    with no city filtering; checkout and order creation REQUIRE a city.
 */
export interface CityContext {
  id: string;
  slug: string;
  name: string;
  /** Signed percentage applied to base prices that have no explicit override. */
  adjustPercent: number;
}

export interface CityRule {
  available: boolean;
  priceOverride: number | null;
}

type Db = Knex | Knex.Transaction;

export function effectivePrice(base: number, rule: Pick<CityRule, "priceOverride"> | undefined, adjustPercent: number): number {
  if (rule?.priceOverride != null) return roundMoney(rule.priceOverride);
  const adjusted = roundMoney(base * (1 + adjustPercent / 100));
  return adjusted > 0 ? adjusted : roundMoney(base);
}

/** Resolves an active city by slug. `undefined`/empty => no city context. Unknown or inactive slug => 400. */
export async function resolveCity(slug: string | undefined | null, db: Db = getDb()): Promise<CityContext | null> {
  const s = slug?.trim();
  if (!s) return null;
  const row: { id: string; slug: string; name: string; active: number | boolean; pct: string | number | null } | undefined = await db("cities as c")
    .leftJoin("shop_city_pricing as p", "p.city_id", "c.id")
    .where("c.slug", s)
    .first("c.id", "c.slug", "c.name", "c.active", "p.product_price_adjust_percent as pct");
  if (!row || !row.active) throw new ValidationError("That city is not available. Please choose another city.");
  return { id: row.id, slug: row.slug, name: row.name, adjustPercent: row.pct == null ? 0 : Number(row.pct) };
}

export async function loadCityRules(db: Db, productIds: string[], cityId: string): Promise<Map<string, CityRule>> {
  const map = new Map<string, CityRule>();
  if (productIds.length === 0) return map;
  const rows: Array<{ product_id: string; available: number | boolean; price_override: string | number | null }> = await db("shop_product_cities")
    .whereIn("product_id", productIds)
    .andWhere({ city_id: cityId })
    .select("product_id", "available", "price_override");
  for (const r of rows) map.set(r.product_id, { available: Boolean(r.available), priceOverride: r.price_override == null ? null : Number(r.price_override) });
  return map;
}

// ---------------------------------------------------------------------------
// Admin: per-product city rows
// ---------------------------------------------------------------------------

export interface AdminProductCityDto {
  cityId: string;
  slug: string;
  name: string;
  state: string;
  available: boolean;
  priceOverride: number | null;
  /** What a customer in this city pays right now (override, else base adjusted by the city %). */
  effectivePrice: number;
  cityAdjustPercent: number;
}

export async function listProductCities(productId: string): Promise<AdminProductCityDto[]> {
  const db = getDb();
  const product: { price: string | number } | undefined = await db("shop_products").where({ id: productId }).first("price");
  if (!product) throw new NotFoundError("Product not found.");
  const base = Number(product.price);
  const rows: Array<{
    id: string; slug: string; name: string; state: string; pct: string | number | null; available: number | boolean | null; price_override: string | number | null;
  }> = await db("cities as c")
    .leftJoin("shop_city_pricing as p", "p.city_id", "c.id")
    .leftJoin("shop_product_cities as pc", function () {
      this.on("pc.city_id", "c.id").andOn("pc.product_id", db.raw("?", [productId]));
    })
    .where("c.active", true)
    .orderBy([{ column: "c.sort_order" }, { column: "c.name" }])
    .select("c.id", "c.slug", "c.name", "c.state", "p.product_price_adjust_percent as pct", "pc.available", "pc.price_override");
  return rows.map((r) => {
    const adj = r.pct == null ? 0 : Number(r.pct);
    const override = r.price_override == null ? null : Number(r.price_override);
    return {
      cityId: r.id,
      slug: r.slug,
      name: r.name,
      state: r.state,
      available: r.available == null ? true : Boolean(r.available),
      priceOverride: override,
      effectivePrice: effectivePrice(base, { priceOverride: override }, adj),
      cityAdjustPercent: adj,
    };
  });
}

export interface ProductCityInput {
  cityId: string;
  available: boolean;
  priceOverride?: number | null;
}

/**
 * Replaces the product's city rows for the cities supplied (others untouched).
 * A row that is "available, no override" is the default state, so it is deleted
 * rather than stored — keeping the table to genuine exceptions.
 */
export async function setProductCities(productId: string, rows: ProductCityInput[]): Promise<AdminProductCityDto[]> {
  const db = getDb();
  const exists = await db("shop_products").where({ id: productId }).first("id");
  if (!exists) throw new NotFoundError("Product not found.");
  const ids = [...new Set(rows.map((r) => r.cityId))];
  if (ids.length !== rows.length) throw new ValidationError("Each city may appear only once.");
  const valid: Array<{ id: string }> = ids.length ? await db("cities").whereIn("id", ids).select("id") : [];
  if (valid.length !== ids.length) throw new ValidationError("One or more cities do not exist.");

  await db.transaction(async (trx) => {
    for (const r of rows) {
      const override = r.priceOverride == null ? null : roundMoney(r.priceOverride);
      if (r.available && override == null) {
        await trx("shop_product_cities").where({ product_id: productId, city_id: r.cityId }).delete();
        continue;
      }
      const existing = await trx("shop_product_cities").where({ product_id: productId, city_id: r.cityId }).first("id");
      if (existing) {
        await trx("shop_product_cities").where({ id: existing.id }).update({ available: r.available, price_override: override });
      } else {
        await trx("shop_product_cities").insert({ id: randomUUID(), product_id: productId, city_id: r.cityId, available: r.available, price_override: override });
      }
    }
  });
  return listProductCities(productId);
}

// ---------------------------------------------------------------------------
// Admin: per-city product price adjustment
// ---------------------------------------------------------------------------

export interface CityPricingDto {
  cityId: string;
  slug: string;
  name: string;
  state: string;
  productPriceAdjustPercent: number;
}

export async function listCityPricing(): Promise<CityPricingDto[]> {
  const rows: Array<{ id: string; slug: string; name: string; state: string; pct: string | number | null }> = await getDb()("cities as c")
    .leftJoin("shop_city_pricing as p", "p.city_id", "c.id")
    .where("c.active", true)
    .orderBy([{ column: "c.sort_order" }, { column: "c.name" }])
    .select("c.id", "c.slug", "c.name", "c.state", "p.product_price_adjust_percent as pct");
  return rows.map((r) => ({ cityId: r.id, slug: r.slug, name: r.name, state: r.state, productPriceAdjustPercent: r.pct == null ? 0 : Number(r.pct) }));
}

export async function setCityPricing(rows: Array<{ cityId: string; productPriceAdjustPercent: number }>): Promise<CityPricingDto[]> {
  const db = getDb();
  const ids = [...new Set(rows.map((r) => r.cityId))];
  if (ids.length !== rows.length) throw new ValidationError("Each city may appear only once.");
  const valid: Array<{ id: string }> = ids.length ? await db("cities").whereIn("id", ids).select("id") : [];
  if (valid.length !== ids.length) throw new ValidationError("One or more cities do not exist.");
  await db.transaction(async (trx) => {
    for (const r of rows) {
      const pct = Math.round(r.productPriceAdjustPercent * 100) / 100;
      const existing = await trx("shop_city_pricing").where({ city_id: r.cityId }).first("city_id");
      if (existing) await trx("shop_city_pricing").where({ city_id: r.cityId }).update({ product_price_adjust_percent: pct });
      else await trx("shop_city_pricing").insert({ city_id: r.cityId, product_price_adjust_percent: pct });
    }
  });
  return listCityPricing();
}
