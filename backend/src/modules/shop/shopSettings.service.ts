import { getDb } from "../../database/db";
import { roundMoney } from "../../shared/pricing";
import type { ShopSettingsDto } from "./shop.types";

/**
 * Admin-configurable store settings (delivery charge, free-delivery threshold,
 * default delivery/return text). Stored as key/value rows in `shop_settings`
 * so changing them never needs a deploy; defaults apply until an admin sets
 * them. Delivery charge is applied by the SERVER at pricing/order time.
 */
const TABLE = "shop_settings";

const DEFAULTS: ShopSettingsDto = {
  deliveryCharge: 0,
  freeDeliveryThreshold: null,
  defaultDeliveryInfo: null,
  defaultReturnInfo: null,
  lowStockThresholdDefault: 5,
};

export async function getShopSettings(): Promise<ShopSettingsDto> {
  const rows: Array<{ key: string; value: string | null }> = await getDb()(TABLE).select("key", "value");
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const num = (k: string): number | null => {
    const v = map.get(k);
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    deliveryCharge: roundMoney(num("delivery_charge") ?? DEFAULTS.deliveryCharge),
    freeDeliveryThreshold: num("free_delivery_threshold"),
    defaultDeliveryInfo: map.get("default_delivery_info") ?? null,
    defaultReturnInfo: map.get("default_return_info") ?? null,
    lowStockThresholdDefault: Math.trunc(num("low_stock_threshold_default") ?? DEFAULTS.lowStockThresholdDefault),
  };
}

/** Delivery charge for a given subtotal under the current settings (free above the threshold). */
export function computeDeliveryCharge(subtotal: number, settings: ShopSettingsDto): number {
  if (settings.freeDeliveryThreshold != null && subtotal >= settings.freeDeliveryThreshold) return 0;
  return roundMoney(settings.deliveryCharge);
}

export async function updateShopSettings(input: Partial<ShopSettingsDto>): Promise<ShopSettingsDto> {
  const entries: Array<[string, string | null]> = [];
  if (input.deliveryCharge !== undefined) entries.push(["delivery_charge", String(input.deliveryCharge)]);
  if (input.freeDeliveryThreshold !== undefined)
    entries.push(["free_delivery_threshold", input.freeDeliveryThreshold == null ? null : String(input.freeDeliveryThreshold)]);
  if (input.defaultDeliveryInfo !== undefined) entries.push(["default_delivery_info", input.defaultDeliveryInfo]);
  if (input.defaultReturnInfo !== undefined) entries.push(["default_return_info", input.defaultReturnInfo]);
  if (input.lowStockThresholdDefault !== undefined)
    entries.push(["low_stock_threshold_default", String(input.lowStockThresholdDefault)]);

  const db = getDb();
  for (const [key, value] of entries) {
    await db(TABLE).insert({ key, value }).onConflict("key").merge({ value });
  }
  return getShopSettings();
}
