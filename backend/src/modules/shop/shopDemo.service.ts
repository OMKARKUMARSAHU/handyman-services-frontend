import { randomUUID } from "node:crypto";
import { getDb } from "../../database/db";
import { slugify } from "./shopCategories.service";

/**
 * Optional, admin-triggered sample catalogue (POST /admin/shop/seed-demo) so the Products section can be
 * reviewed before real stock data exists. Rows are flagged `is_demo = true` internally (this only enables the
 * bundled placeholder illustration when a product has no image; nothing about it is shown in the UI), names
 * and descriptions are plain product wording with no "Demo" text, and prices are ILLUSTRATIVE PLACEHOLDERS that
 * are meant to be edited. Descriptions/specs deliberately contain NO invented brand names, model compatibility,
 * warranty or return promises. Idempotent: rows are matched by SKU / slug, so running it twice creates nothing
 * new and never overwrites an item the admin has since edited. SKUs keep their historical "DEMO-" prefix so
 * that databases seeded earlier are still recognised (no duplicates).
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
  { name: "Water Purifiers", description: "RO and UV water purifiers for home use." },
  { name: "Washing Machines", description: "Washing machines for home use." },
  { name: "Refrigerators", description: "Refrigerators for home use." },
  { name: "Water Purifier Filters & Spares", description: "Replacement filters, membranes and accessories." },
  { name: "AC & Appliance Accessories", description: "Filters and cleaning accessories for air conditioners and appliances." },
  { name: "Cleaning Products", description: "Household and appliance cleaning supplies." },
  { name: "Pest Control Products", description: "Household pest-control supplies." },
  { name: "Vacuum & Cleaning Tools", description: "Vacuum accessories and manual cleaning tools." },
  { name: "Home Maintenance Accessories", description: "Everyday home-maintenance accessories." },
];

const PRODUCTS: DemoProduct[] = [
  { category: "Water Purifiers", name: "RO Water Purifier", sku: "DEMO-WP-RO-001", price: 9999, mrp: 12999, stock: 25, short: "RO purifier.", specs: [{ label: "Type", value: "RO" }], featured: true },
  { category: "Water Purifiers", name: "RO + UV Water Purifier", sku: "DEMO-WP-ROUV-001", price: 12999, mrp: 15999, stock: 18, short: "RO + UV purifier.", specs: [{ label: "Type", value: "RO + UV" }] },
  { category: "Water Purifiers", name: "UV Water Purifier", sku: "DEMO-WP-UV-001", price: 6999, stock: 12, short: "UV purifier.", specs: [{ label: "Type", value: "UV" }] },
  { category: "Washing Machines", name: "Washing Machine", sku: "DEMO-WM-001", price: 24990, mrp: 29990, stock: 15, short: "Washing machine.", featured: true },
  { category: "Refrigerators", name: "Refrigerator", sku: "DEMO-RF-001", price: 27990, mrp: 33990, stock: 10, short: "Refrigerator.", featured: true },
  { category: "Water Purifier Filters & Spares", name: "RO Membrane", sku: "DEMO-SP-MEM-001", price: 1499, mrp: 1899, stock: 60, short: "Replacement RO membrane.", specs: [{ label: "Part", value: "RO membrane" }] },
  { category: "Water Purifier Filters & Spares", name: "Sediment Filter", sku: "DEMO-SP-SED-001", price: 299, stock: 100, short: "Sediment pre-filter.", specs: [{ label: "Part", value: "Sediment filter" }] },
  { category: "Water Purifier Filters & Spares", name: "Carbon Filter", sku: "DEMO-SP-CARB-001", price: 349, stock: 100, short: "Activated-carbon filter.", specs: [{ label: "Part", value: "Carbon filter" }] },
  { category: "Water Purifier Filters & Spares", name: "Purifier Installation Accessories Kit", sku: "DEMO-SP-ACC-001", price: 499, stock: 40, short: "Fittings and tubing accessories." },
  { category: "AC & Appliance Accessories", name: "AC Filter", sku: "DEMO-AC-FIL-001", price: 399, stock: 80, short: "Replacement AC filter. Check compatibility before ordering." },
  { category: "AC & Appliance Accessories", name: "AC Cleaning Kit", sku: "DEMO-AC-CLN-001", price: 599, stock: 45, short: "AC cleaning accessories." },
  { category: "Cleaning Products", name: "Multi-surface Cleaner", sku: "DEMO-CL-MSC-001", price: 199, stock: 120, short: "Multi-surface cleaning liquid." },
  { category: "Cleaning Products", name: "Appliance Descaler", sku: "DEMO-CL-DSC-001", price: 249, stock: 70, short: "Descaling agent for appliances." },
  { category: "Pest Control Products", name: "Cockroach Gel", sku: "DEMO-PC-GEL-001", price: 349, stock: 60, short: "Household pest-control gel. Follow label directions." },
  { category: "Pest Control Products", name: "Ant & Insect Spray", sku: "DEMO-PC-SPR-001", price: 279, stock: 55, short: "Household insect spray. Follow label directions." },
  { category: "Vacuum & Cleaning Tools", name: "Vacuum Cleaner Filter", sku: "DEMO-VC-FIL-001", price: 449, stock: 35, short: "Vacuum filter accessory." },
  { category: "Vacuum & Cleaning Tools", name: "Microfibre Cloth Pack", sku: "DEMO-VC-CLT-001", price: 299, stock: 90, short: "Pack of microfibre cleaning cloths." },
  { category: "Home Maintenance Accessories", name: "Drain Cleaning Tool", sku: "DEMO-HM-DRN-001", price: 199, stock: 50, short: "Manual drain-cleaning tool." },
];

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
        description: null,
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
