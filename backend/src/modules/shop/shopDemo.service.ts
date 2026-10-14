import { randomUUID } from "node:crypto";
import { getDb } from "../../database/db";
import { slugify } from "./shopCategories.service";

/**
 * Optional, admin-triggered demo catalogue so the Products section can be
 * reviewed before real stock data exists. Everything it creates is flagged
 * `is_demo = true` (the storefront shows a "Demo" label), prices are
 * ILLUSTRATIVE PLACEHOLDERS (not market prices) and are meant to be edited, and
 * descriptions/specs deliberately contain NO invented brand names, model
 * compatibility, warranty or return promises. Idempotent: rows are matched by
 * SKU / slug, so running it twice creates nothing new and never overwrites an
 * item the admin has since edited.
 */

interface DemoCategory {
  name: string;
  description: string;
}
interface DemoProduct {
  category: string;
  name: string;
  sku: string;
  price: number;
  mrp?: number;
  stock: number;
  short: string;
  specs?: Array<{ label: string; value: string }>;
  featured?: boolean;
}

const CATEGORIES: DemoCategory[] = [
  { name: "Water Purifiers", description: "RO and UV water purifiers for home use. (Demo category)" },
  { name: "Washing Machines", description: "Washing machines for home use. (Demo category)" },
  { name: "Refrigerators", description: "Refrigerators for home use. (Demo category)" },
  { name: "Water Purifier Filters & Spares", description: "Replacement filters, membranes and accessories. (Demo category)" },
  { name: "AC & Appliance Accessories", description: "Filters and cleaning accessories for air conditioners and appliances. (Demo category)" },
  { name: "Cleaning Products", description: "Household and appliance cleaning supplies. (Demo category)" },
  { name: "Pest Control Products", description: "Household pest-control supplies. (Demo category)" },
  { name: "Vacuum & Cleaning Tools", description: "Vacuum accessories and manual cleaning tools. (Demo category)" },
  { name: "Home Maintenance Accessories", description: "Everyday home-maintenance accessories. (Demo category)" },
];

const PRODUCTS: DemoProduct[] = [
  { category: "Water Purifiers", name: "RO Water Purifier (Demo)", sku: "DEMO-WP-RO-001", price: 9999, mrp: 12999, stock: 25, short: "Demo listing — RO purifier. Replace with your real product.", specs: [{ label: "Type", value: "RO" }], featured: true },
  { category: "Water Purifiers", name: "RO + UV Water Purifier (Demo)", sku: "DEMO-WP-ROUV-001", price: 12999, mrp: 15999, stock: 18, short: "Demo listing — RO + UV purifier. Replace with your real product.", specs: [{ label: "Type", value: "RO + UV" }] },
  { category: "Water Purifiers", name: "UV Water Purifier (Demo)", sku: "DEMO-WP-UV-001", price: 6999, stock: 12, short: "Demo listing — UV purifier. Replace with your real product.", specs: [{ label: "Type", value: "UV" }] },
  { category: "Washing Machines", name: "Washing Machine (Demo)", sku: "DEMO-WM-001", price: 24990, mrp: 29990, stock: 15, short: "Demo listing — washing machine. Replace with your real product.", featured: true },
  { category: "Refrigerators", name: "Refrigerator (Demo)", sku: "DEMO-RF-001", price: 27990, mrp: 33990, stock: 10, short: "Demo listing — refrigerator. Replace with your real product.", featured: true },
  { category: "Water Purifier Filters & Spares", name: "RO Membrane (Demo)", sku: "DEMO-SP-MEM-001", price: 1499, mrp: 1899, stock: 60, short: "Demo listing — replacement RO membrane.", specs: [{ label: "Part", value: "RO membrane" }] },
  { category: "Water Purifier Filters & Spares", name: "Sediment Filter (Demo)", sku: "DEMO-SP-SED-001", price: 299, stock: 100, short: "Demo listing — sediment pre-filter.", specs: [{ label: "Part", value: "Sediment filter" }] },
  { category: "Water Purifier Filters & Spares", name: "Carbon Filter (Demo)", sku: "DEMO-SP-CARB-001", price: 349, stock: 100, short: "Demo listing — activated-carbon filter.", specs: [{ label: "Part", value: "Carbon filter" }] },
  { category: "Water Purifier Filters & Spares", name: "Purifier Installation Accessories Kit (Demo)", sku: "DEMO-SP-ACC-001", price: 499, stock: 40, short: "Demo listing — fittings and tubing accessories." },
  { category: "AC & Appliance Accessories", name: "AC Filter (Demo)", sku: "DEMO-AC-FIL-001", price: 399, stock: 80, short: "Demo listing — replacement AC filter. Check compatibility before ordering." },
  { category: "AC & Appliance Accessories", name: "AC Cleaning Kit (Demo)", sku: "DEMO-AC-CLN-001", price: 599, stock: 45, short: "Demo listing — AC cleaning accessories." },
  { category: "Cleaning Products", name: "Multi-surface Cleaner (Demo)", sku: "DEMO-CL-MSC-001", price: 199, stock: 120, short: "Demo listing — multi-surface cleaning liquid." },
  { category: "Cleaning Products", name: "Appliance Descaler (Demo)", sku: "DEMO-CL-DSC-001", price: 249, stock: 70, short: "Demo listing — descaling agent for appliances." },
  { category: "Pest Control Products", name: "Cockroach Gel (Demo)", sku: "DEMO-PC-GEL-001", price: 349, stock: 60, short: "Demo listing — household pest-control gel. Follow label directions." },
  { category: "Pest Control Products", name: "Ant & Insect Spray (Demo)", sku: "DEMO-PC-SPR-001", price: 279, stock: 55, short: "Demo listing — household insect spray. Follow label directions." },
  { category: "Vacuum & Cleaning Tools", name: "Vacuum Cleaner Filter (Demo)", sku: "DEMO-VC-FIL-001", price: 449, stock: 35, short: "Demo listing — vacuum filter accessory." },
  { category: "Vacuum & Cleaning Tools", name: "Microfibre Cloth Pack (Demo)", sku: "DEMO-VC-CLT-001", price: 299, stock: 90, short: "Demo listing — pack of microfibre cleaning cloths." },
  { category: "Home Maintenance Accessories", name: "Drain Cleaning Tool (Demo)", sku: "DEMO-HM-DRN-001", price: 199, stock: 50, short: "Demo listing — manual drain-cleaning tool." },
];

const DEMO_NOTE =
  "This is DEMO data created to preview the Products section. The price, stock and details are placeholders — edit or replace them in Admin → Shop before going live. Not a verified market price.";

export async function seedShopDemoData(): Promise<{ categoriesCreated: number; productsCreated: number }> {
  const db = getDb();
  let categoriesCreated = 0;
  let productsCreated = 0;
  const catIdByName = new Map<string, string>();

  await db.transaction(async (trx) => {
    let sort = Number(((await trx("shop_categories").max({ m: "sort_order" }).first()) as { m: number | null } | undefined)?.m ?? -1) + 1;
    for (const c of CATEGORIES) {
      const slug = slugify(c.name);
      const existing: { id: string } | undefined = await trx("shop_categories").where({ slug }).first("id");
      if (existing) {
        catIdByName.set(c.name, existing.id);
        continue;
      }
      const id = randomUUID();
      await trx("shop_categories").insert({ id, slug, name: c.name, description: c.description, sort_order: sort++, active: true });
      catIdByName.set(c.name, id);
      categoriesCreated++;
    }
    for (const p of PRODUCTS) {
      const slug = slugify(p.name, 160);
      const exists = await trx("shop_products").where({ sku: p.sku }).orWhere({ slug }).first("id");
      if (exists) continue;
      await trx("shop_products").insert({
        id: randomUUID(),
        category_id: catIdByName.get(p.category)!,
        slug,
        sku: p.sku,
        name: p.name,
        short_description: p.short,
        description: DEMO_NOTE,
        price: p.price,
        mrp: p.mrp ?? null,
        stock_quantity: p.stock,
        low_stock_threshold: 5,
        track_inventory: true,
        status: "published",
        active: true,
        featured: Boolean(p.featured),
        specifications: JSON.stringify(p.specs ?? []),
        compatible_models: JSON.stringify([]),
        is_demo: true,
      });
      productsCreated++;
    }
  });
  return { categoriesCreated, productsCreated };
}
