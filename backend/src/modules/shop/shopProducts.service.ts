import { randomUUID } from "node:crypto";
import type { Knex } from "knex";
import { getDb } from "../../database/db";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors";
import { buildPageMeta, parsePagination, type Meta } from "../../shared/response";
import { roundMoney } from "../../shared/pricing";
import { getShopSettings } from "./shopSettings.service";
import { effectivePrice, resolveCity, type CityContext } from "./shopCity.service";
import { slugify, uniqueSlug } from "./shopCategories.service";
import {
  MAX_QTY_PER_LINE,
  type ShopAdminProductDto,
  type ShopImageDto,
  type ShopProductDetailDto,
  type ShopProductRow,
  type ShopProductSummaryDto,
  type ShopSettingsDto,
  type ShopSpecification,
  type ShopStockStatus,
  type ShopVideoDto,
} from "./shop.types";

const PRODUCTS = "shop_products";
const CATEGORIES = "shop_categories";
const IMAGES = "shop_product_images";
const VIDEOS = "shop_product_videos";

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit tests)
// ---------------------------------------------------------------------------

export function toNumber(v: string | number | null | undefined): number {
  return v == null ? 0 : Number(v);
}

export function computeStockStatus(row: Pick<ShopProductRow, "stock_quantity" | "low_stock_threshold" | "track_inventory">): ShopStockStatus {
  if (!row.track_inventory) return "in_stock";
  if (row.stock_quantity <= 0) return "out_of_stock";
  if (row.stock_quantity <= row.low_stock_threshold) return "low_stock";
  return "in_stock";
}

export function computeDiscountPercent(price: number, mrp: number | null): number | null {
  if (mrp == null || mrp <= price || mrp <= 0) return null;
  return Math.round(((mrp - price) / mrp) * 100);
}

export function maxOrderQuantityFor(row: Pick<ShopProductRow, "stock_quantity" | "track_inventory">): number {
  if (!row.track_inventory) return MAX_QTY_PER_LINE;
  return Math.max(0, Math.min(row.stock_quantity, MAX_QTY_PER_LINE));
}

/**
 * Parses a user-supplied YouTube link (watch / youtu.be / embed / shorts) into
 * its 11-character video id. Anything that is not an https YouTube URL with a
 * valid id is rejected, so the page never embeds an arbitrary URL.
 */
export function parseYouTubeId(raw: string): string | null {
  const input = raw.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") {
    id = url.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/);
      id = m ? m[1]! : null;
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// ---------------------------------------------------------------------------
// Row loading / mapping
// ---------------------------------------------------------------------------

interface ProductJoinRow extends ShopProductRow {
  category_slug: string;
  category_name: string;
  category_active: number | boolean;
  /** Only present when the query was city-scoped (left join on shop_product_cities). */
  city_available?: number | boolean | null;
  city_price_override?: string | number | null;
}

function baseQuery(db: Knex, publicOnly: boolean, city?: CityContext | null): Knex.QueryBuilder {
  const q = db(`${PRODUCTS} as p`)
    .join(`${CATEGORIES} as c`, "c.id", "p.category_id")
    .select("p.*", "c.slug as category_slug", "c.name as category_name", "c.active as category_active");
  if (city) {
    q.leftJoin("shop_product_cities as pc", function () {
      this.on("pc.product_id", "p.id").andOn("pc.city_id", db.raw("?", [city.id]));
    }).select("pc.available as city_available", "pc.price_override as city_price_override");
  }
  if (publicOnly) q.where({ "p.status": "published", "p.active": true, "c.active": true });
  return q;
}

async function loadImages(productIds: string[]): Promise<Map<string, ShopImageDto[]>> {
  const map = new Map<string, ShopImageDto[]>();
  if (productIds.length === 0) return map;
  const rows: Array<{ id: string; product_id: string; media_id: string; alt_text: string | null; sort_order: number; is_primary: number | boolean; url: string }> =
    await getDb()(`${IMAGES} as i`)
      .join("media as m", "m.id", "i.media_id")
      .whereIn("i.product_id", productIds)
      .orderBy([{ column: "i.sort_order" }, { column: "i.created_at" }])
      .select("i.id", "i.product_id", "i.media_id", "i.alt_text", "i.sort_order", "i.is_primary", "m.url");
  for (const r of rows) {
    const list = map.get(r.product_id) ?? [];
    list.push({ id: r.id, mediaId: r.media_id, url: r.url, altText: r.alt_text, sortOrder: r.sort_order, isPrimary: Boolean(r.is_primary) });
    map.set(r.product_id, list);
  }
  return map;
}

async function loadVideos(productIds: string[]): Promise<Map<string, ShopVideoDto[]>> {
  const map = new Map<string, ShopVideoDto[]>();
  if (productIds.length === 0) return map;
  const rows: Array<{ id: string; product_id: string; kind: "youtube" | "upload"; youtube_id: string | null; media_id: string | null; title: string | null; sort_order: number; url: string | null }> =
    await getDb()(`${VIDEOS} as v`)
      .leftJoin("media as m", "m.id", "v.media_id")
      .whereIn("v.product_id", productIds)
      .orderBy([{ column: "v.sort_order" }, { column: "v.created_at" }])
      .select("v.id", "v.product_id", "v.kind", "v.youtube_id", "v.media_id", "v.title", "v.sort_order", "m.url");
  for (const r of rows) {
    const list = map.get(r.product_id) ?? [];
    list.push({
      id: r.id,
      kind: r.kind,
      title: r.title,
      sortOrder: r.sort_order,
      mediaId: r.media_id,
      url: r.kind === "upload" ? r.url : null,
      youtubeId: r.youtube_id,
      embedUrl: r.youtube_id ? `https://www.youtube-nocookie.com/embed/${r.youtube_id}` : null,
      watchUrl: r.youtube_id ? `https://www.youtube.com/watch?v=${r.youtube_id}` : null,
    });
    map.set(r.product_id, list);
  }
  return map;
}

function toSummary(row: ProductJoinRow, images: ShopImageDto[], city?: CityContext | null): ShopProductSummaryDto {
  const base = roundMoney(toNumber(row.price));
  const price = city
    ? effectivePrice(base, row.city_price_override == null ? undefined : { priceOverride: Number(row.city_price_override) }, city.adjustPercent)
    : base;
  const mrp = row.mrp == null ? null : roundMoney(toNumber(row.mrp));
  const stockStatus = computeStockStatus(row);
  const primary = images.find((i) => i.isPrimary) ?? images[0] ?? null;
  return {
    id: row.id,
    slug: row.slug,
    sku: row.sku,
    name: row.name,
    shortDescription: row.short_description,
    price,
    mrp: mrp != null && mrp > price ? mrp : null,
    discountPercent: computeDiscountPercent(price, mrp),
    stockStatus,
    inStock: stockStatus !== "out_of_stock",
    featured: Boolean(row.featured),
    isDemo: Boolean(row.is_demo),
    category: { id: row.category_id, slug: row.category_slug, name: row.category_name },
    primaryImage: primary ? { url: primary.url, altText: primary.altText } : null,
    availableInCity: city ? row.city_available == null || Boolean(row.city_available) : true,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function toDetail(row: ProductJoinRow, images: ShopImageDto[], videos: ShopVideoDto[], settings: ShopSettingsDto, city?: CityContext | null): ShopProductDetailDto {
  return {
    ...toSummary(row, images, city),
    description: row.description,
    images,
    videos,
    specifications: parseJson<ShopSpecification[]>(row.specifications, []),
    compatibleModels: parseJson<string[]>(row.compatible_models, []),
    deliveryInfo: row.delivery_info ?? settings.defaultDeliveryInfo,
    returnInfo: row.return_info ?? settings.defaultReturnInfo,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    maxOrderQuantity: maxOrderQuantityFor(row),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function toAdmin(row: ProductJoinRow, images: ShopImageDto[], videos: ShopVideoDto[], settings: ShopSettingsDto): ShopAdminProductDto {
  const detail = toDetail(row, images, videos, settings);
  const track = Boolean(row.track_inventory);
  return {
    ...detail,
    // Admin sees the raw product-level text (not the fallback), so an empty field stays visibly empty.
    deliveryInfo: row.delivery_info,
    returnInfo: row.return_info,
    status: row.status,
    active: Boolean(row.active),
    stockQuantity: row.stock_quantity,
    lowStockThreshold: row.low_stock_threshold,
    trackInventory: track,
    categoryId: row.category_id,
    lowStock: track && row.stock_quantity <= row.low_stock_threshold,
  };
}

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

export interface PublicListProductsParams {
  search?: string;
  category?: string;
  sort?: "newest" | "oldest" | "price_asc" | "price_desc";
  featured?: boolean;
  inStock?: boolean;
  /** City slug. When set, products an admin marked unavailable there are excluded and city prices apply. */
  city?: string;
  page?: number;
  pageSize?: number;
}

export async function listPublicShopProducts(params: PublicListProductsParams): Promise<{ items: ShopProductSummaryDto[]; meta: Meta }> {
  const db = getDb();
  const pagination = parsePagination({ page: params.page, pageSize: params.pageSize ?? 12 });
  const city = await resolveCity(params.city, db);
  const q = baseQuery(db, true, city);
  if (city) q.where((b) => b.whereNull("pc.available").orWhere("pc.available", true));
  if (params.category) q.where("c.slug", params.category);
  if (params.featured) q.where("p.featured", true);
  if (params.inStock) q.where((b) => b.where("p.track_inventory", false).orWhere("p.stock_quantity", ">", 0));
  if (params.search?.trim()) {
    const like = `%${escapeLike(params.search.trim())}%`;
    q.where((b) =>
      b.whereRaw("p.name LIKE ? ESCAPE '\\\\'", [like]).orWhereRaw("p.short_description LIKE ? ESCAPE '\\\\'", [like]).orWhereRaw("p.sku LIKE ? ESCAPE '\\\\'", [like])
    );
  }
  const totalRow = (await q.clone().clearSelect().count({ n: "p.id" }).first()) as unknown as { n: number | string };
  const total = Number(totalRow?.n ?? 0);

  switch (params.sort) {
    case "price_asc":
    case "price_desc": {
      const dir = params.sort === "price_asc" ? "asc" : "desc";
      // City-aware: sort by what the customer would actually pay in that city.
      if (city) q.orderByRaw(`COALESCE(pc.price_override, ROUND(p.price * (1 + ? / 100), 2)) ${dir}, p.created_at DESC`, [city.adjustPercent]);
      else q.orderBy([{ column: "p.price", order: dir }, { column: "p.created_at", order: "desc" }]);
      break;
    }
    case "oldest":
      // Stable "shelf" order (used by the homepage featured block): oldest first, then lowest price.
      q.orderBy([{ column: "p.created_at", order: "asc" }, { column: "p.price", order: "asc" }, { column: "p.id", order: "asc" }]);
      break;
    default:
      q.orderBy([{ column: "p.created_at", order: "desc" }, { column: "p.id", order: "asc" }]);
  }
  const rows = (await q.limit(pagination.pageSize).offset((pagination.page - 1) * pagination.pageSize)) as ProductJoinRow[];
  const images = await loadImages(rows.map((r) => r.id));
  return { items: rows.map((r) => toSummary(r, images.get(r.id) ?? [], city)), meta: buildPageMeta(pagination, total) };
}

export async function getPublicShopProductBySlug(slug: string, citySlug?: string): Promise<{ product: ShopProductDetailDto; related: ShopProductSummaryDto[] }> {
  const db = getDb();
  const city = await resolveCity(citySlug, db);
  const row = (await baseQuery(db, true, city).where("p.slug", slug).first()) as ProductJoinRow | undefined;
  if (!row) throw new NotFoundError("Product not found.");
  const [images, videos, settings] = await Promise.all([loadImages([row.id]), loadVideos([row.id]), getShopSettings()]);

  const relatedQuery = baseQuery(db, true, city);
  if (city) relatedQuery.where((b) => b.whereNull("pc.available").orWhere("pc.available", true));
  const relatedRows = (await relatedQuery
    .where("p.category_id", row.category_id)
    .whereNot("p.id", row.id)
    .orderBy([{ column: "p.featured", order: "desc" }, { column: "p.created_at", order: "desc" }])
    .limit(4)) as ProductJoinRow[];
  const relatedImages = await loadImages(relatedRows.map((r) => r.id));

  return {
    product: toDetail(row, images.get(row.id) ?? [], videos.get(row.id) ?? [], settings, city),
    related: relatedRows.map((r) => toSummary(r, relatedImages.get(r.id) ?? [], city)),
  };
}

/** Sitemap feed: only products that are publicly visible right now. */
export async function listPublishedShopProductsForSitemap(): Promise<Array<{ slug: string; updatedAt: string }>> {
  const rows = (await baseQuery(getDb(), true).orderBy("p.updated_at", "desc")) as ProductJoinRow[];
  return rows.map((r) => ({ slug: r.slug, updatedAt: new Date(r.updated_at).toISOString() }));
}

// ---------------------------------------------------------------------------
// Admin reads
// ---------------------------------------------------------------------------

export interface AdminListProductsParams {
  search?: string;
  categoryId?: string;
  status?: "draft" | "published";
  active?: boolean;
  lowStock?: boolean;
  page?: number;
  pageSize?: number;
}

export async function listAdminShopProducts(params: AdminListProductsParams): Promise<{ items: ShopAdminProductDto[]; meta: Meta }> {
  const db = getDb();
  const pagination = parsePagination({ page: params.page, pageSize: params.pageSize });
  const q = baseQuery(db, false);
  if (params.categoryId) q.where("p.category_id", params.categoryId);
  if (params.status) q.where("p.status", params.status);
  if (params.active !== undefined) q.where("p.active", params.active);
  if (params.lowStock) q.where("p.track_inventory", true).whereRaw("p.stock_quantity <= p.low_stock_threshold");
  if (params.search?.trim()) {
    const like = `%${escapeLike(params.search.trim())}%`;
    q.where((b) => b.whereRaw("p.name LIKE ? ESCAPE '\\\\'", [like]).orWhereRaw("p.sku LIKE ? ESCAPE '\\\\'", [like]));
  }
  const totalRow = (await q.clone().clearSelect().count({ n: "p.id" }).first()) as unknown as { n: number | string };
  const total = Number(totalRow?.n ?? 0);
  if (params.lowStock) q.orderBy([{ column: "p.stock_quantity", order: "asc" }, { column: "p.name" }]);
  else q.orderBy([{ column: "p.created_at", order: "desc" }, { column: "p.id" }]);
  const rows = (await q.limit(pagination.pageSize).offset((pagination.page - 1) * pagination.pageSize)) as ProductJoinRow[];
  const ids = rows.map((r) => r.id);
  const [images, videos, settings] = await Promise.all([loadImages(ids), loadVideos(ids), getShopSettings()]);
  return {
    items: rows.map((r) => toAdmin(r, images.get(r.id) ?? [], videos.get(r.id) ?? [], settings)),
    meta: buildPageMeta(pagination, total),
  };
}

export async function getAdminShopProduct(id: string): Promise<ShopAdminProductDto> {
  const row = (await baseQuery(getDb(), false).where("p.id", id).first()) as ProductJoinRow | undefined;
  if (!row) throw new NotFoundError("Product not found.");
  const [images, videos, settings] = await Promise.all([loadImages([id]), loadVideos([id]), getShopSettings()]);
  return toAdmin(row, images.get(id) ?? [], videos.get(id) ?? [], settings);
}

// ---------------------------------------------------------------------------
// Admin writes
// ---------------------------------------------------------------------------

export interface ShopProductInput {
  categoryId?: string;
  name?: string;
  slug?: string;
  sku?: string;
  shortDescription?: string | null;
  description?: string | null;
  price?: number;
  mrp?: number | null;
  stockQuantity?: number;
  lowStockThreshold?: number;
  trackInventory?: boolean;
  status?: "draft" | "published";
  active?: boolean;
  featured?: boolean;
  specifications?: ShopSpecification[];
  compatibleModels?: string[];
  deliveryInfo?: string | null;
  returnInfo?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  isDemo?: boolean;
}

function isDuplicateKey(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && (err as { code?: string }).code === "ER_DUP_ENTRY");
}

async function assertCategoryExists(categoryId: string): Promise<void> {
  const c = await getDb()(CATEGORIES).where({ id: categoryId }).first("id");
  if (!c) throw new ValidationError("The selected shop category does not exist.");
}

export async function createShopProduct(input: ShopProductInput & { categoryId: string; name: string; sku: string; price: number; stockQuantity: number }): Promise<ShopAdminProductDto> {
  const db = getDb();
  await assertCategoryExists(input.categoryId);
  const slug = input.slug ?? (await uniqueSlug(PRODUCTS, slugify(input.name, 160), undefined, 160));
  if (input.slug && (await db(PRODUCTS).where({ slug }).first("id"))) throw new ConflictError(`A product with the slug "${slug}" already exists.`);
  if (await db(PRODUCTS).where({ sku: input.sku }).first("id")) throw new ConflictError(`A product with the SKU "${input.sku}" already exists.`);
  const settings = await getShopSettings();
  const id = randomUUID();
  try {
    await db(PRODUCTS).insert({
      id,
      category_id: input.categoryId,
      slug,
      sku: input.sku,
      name: input.name,
      short_description: input.shortDescription ?? null,
      description: input.description ?? null,
      price: roundMoney(input.price),
      mrp: input.mrp == null ? null : roundMoney(input.mrp),
      stock_quantity: input.stockQuantity,
      low_stock_threshold: input.lowStockThreshold ?? settings.lowStockThresholdDefault,
      track_inventory: input.trackInventory ?? true,
      status: input.status ?? "draft",
      active: input.active ?? true,
      featured: input.featured ?? false,
      specifications: JSON.stringify(input.specifications ?? []),
      compatible_models: JSON.stringify(input.compatibleModels ?? []),
      delivery_info: input.deliveryInfo ?? null,
      return_info: input.returnInfo ?? null,
      seo_title: input.seoTitle ?? null,
      seo_description: input.seoDescription ?? null,
      is_demo: input.isDemo ?? false,
    });
  } catch (err) {
    if (isDuplicateKey(err)) throw new ConflictError("A product with this slug or SKU already exists.");
    throw err;
  }
  return getAdminShopProduct(id);
}

export async function updateShopProduct(id: string, input: ShopProductInput): Promise<ShopAdminProductDto> {
  const db = getDb();
  const existing: ShopProductRow | undefined = await db(PRODUCTS).where({ id }).first();
  if (!existing) throw new NotFoundError("Product not found.");

  const patch: Record<string, unknown> = {};
  if (input.categoryId !== undefined && input.categoryId !== existing.category_id) {
    await assertCategoryExists(input.categoryId);
    patch.category_id = input.categoryId;
  }
  if (input.slug !== undefined && input.slug !== existing.slug) {
    if (await db(PRODUCTS).where({ slug: input.slug }).whereNot({ id }).first("id")) throw new ConflictError(`A product with the slug "${input.slug}" already exists.`);
    patch.slug = input.slug;
  }
  if (input.sku !== undefined && input.sku !== existing.sku) {
    if (await db(PRODUCTS).where({ sku: input.sku }).whereNot({ id }).first("id")) throw new ConflictError(`A product with the SKU "${input.sku}" already exists.`);
    patch.sku = input.sku;
  }
  if (input.name !== undefined) patch.name = input.name;
  if (input.shortDescription !== undefined) patch.short_description = input.shortDescription;
  if (input.description !== undefined) patch.description = input.description;
  if (input.price !== undefined) patch.price = roundMoney(input.price);
  if (input.mrp !== undefined) patch.mrp = input.mrp == null ? null : roundMoney(input.mrp);
  if (input.stockQuantity !== undefined) patch.stock_quantity = input.stockQuantity;
  if (input.lowStockThreshold !== undefined) patch.low_stock_threshold = input.lowStockThreshold;
  if (input.trackInventory !== undefined) patch.track_inventory = input.trackInventory;
  if (input.status !== undefined) patch.status = input.status;
  if (input.active !== undefined) patch.active = input.active;
  if (input.featured !== undefined) patch.featured = input.featured;
  if (input.specifications !== undefined) patch.specifications = JSON.stringify(input.specifications);
  if (input.compatibleModels !== undefined) patch.compatible_models = JSON.stringify(input.compatibleModels);
  if (input.deliveryInfo !== undefined) patch.delivery_info = input.deliveryInfo;
  if (input.returnInfo !== undefined) patch.return_info = input.returnInfo;
  if (input.seoTitle !== undefined) patch.seo_title = input.seoTitle;
  if (input.seoDescription !== undefined) patch.seo_description = input.seoDescription;
  if (input.isDemo !== undefined) patch.is_demo = input.isDemo;

  // Cross-field price rule against the stored values when only one side is sent.
  const nextPrice = patch.price !== undefined ? Number(patch.price) : toNumber(existing.price);
  const nextMrp = patch.mrp !== undefined ? (patch.mrp == null ? null : Number(patch.mrp)) : existing.mrp == null ? null : toNumber(existing.mrp);
  if (nextMrp != null && nextMrp < nextPrice) throw new ValidationError("MRP cannot be lower than the selling price.");

  if (Object.keys(patch).length > 0) {
    try {
      await db(PRODUCTS).where({ id }).update(patch);
    } catch (err) {
      if (isDuplicateKey(err)) throw new ConflictError("A product with this slug or SKU already exists.");
      throw err;
    }
  }
  return getAdminShopProduct(id);
}

export async function deleteShopProduct(id: string): Promise<void> {
  const n = await getDb()(PRODUCTS).where({ id }).delete();
  if (!n) throw new NotFoundError("Product not found.");
}

/** Atomic stock set/adjust; a delta can never take stock below zero. */
export async function adjustShopProductStock(id: string, input: { stockQuantity?: number; delta?: number }): Promise<ShopAdminProductDto> {
  const db = getDb();
  if (input.stockQuantity !== undefined) {
    const n = await db(PRODUCTS).where({ id }).update({ stock_quantity: input.stockQuantity });
    if (!n) {
      // MySQL reports 0 changed rows when the value is unchanged — confirm existence.
      if (!(await db(PRODUCTS).where({ id }).first("id"))) throw new NotFoundError("Product not found.");
    }
  } else if (input.delta !== undefined) {
    const delta = input.delta;
    const n = await db(PRODUCTS)
      .where({ id })
      .andWhereRaw("stock_quantity + ? >= 0", [delta])
      .update({ stock_quantity: db.raw("stock_quantity + ?", [delta]) });
    if (!n) {
      if (!(await db(PRODUCTS).where({ id }).first("id"))) throw new NotFoundError("Product not found.");
      throw new ValidationError("That adjustment would take stock below zero.");
    }
  }
  return getAdminShopProduct(id);
}

// ---------------------------------------------------------------------------
// Media (images via Media Library, videos: YouTube / uploaded media)
// ---------------------------------------------------------------------------

export async function setShopProductImages(
  productId: string,
  images: Array<{ mediaId: string; altText?: string | null; isPrimary?: boolean }>
): Promise<ShopAdminProductDto> {
  const db = getDb();
  if (!(await db(PRODUCTS).where({ id: productId }).first("id"))) throw new NotFoundError("Product not found.");
  const ids = images.map((i) => i.mediaId);
  if (new Set(ids).size !== ids.length) throw new ValidationError("The same image was added more than once.");
  if (ids.length > 0) {
    const media: Array<{ id: string; type: string; active: number | boolean }> = await db("media").whereIn("id", ids).select("id", "type", "active");
    const byId = new Map(media.map((m) => [m.id, m]));
    for (const id of ids) {
      const m = byId.get(id);
      if (!m) throw new ValidationError("One or more selected images were not found in the Media Library.");
      if (m.type !== "image") throw new ValidationError("Only image media can be used as a product image.");
      if (!m.active) throw new ValidationError("An inactive Media Library item cannot be used as a product image.");
    }
  }
  let primaryIndex = images.findIndex((i) => i.isPrimary);
  if (primaryIndex < 0) primaryIndex = 0;
  await db.transaction(async (trx) => {
    await trx(IMAGES).where({ product_id: productId }).delete();
    for (let i = 0; i < images.length; i++) {
      await trx(IMAGES).insert({
        id: randomUUID(),
        product_id: productId,
        media_id: images[i]!.mediaId,
        alt_text: images[i]!.altText ?? null,
        sort_order: i,
        is_primary: i === primaryIndex,
      });
    }
  });
  return getAdminShopProduct(productId);
}

export type ShopVideoInput = { kind: "youtube"; url: string; title?: string | null } | { kind: "upload"; mediaId: string; title?: string | null };

export async function setShopProductVideos(productId: string, videos: ShopVideoInput[]): Promise<ShopAdminProductDto> {
  const db = getDb();
  if (!(await db(PRODUCTS).where({ id: productId }).first("id"))) throw new NotFoundError("Product not found.");

  const prepared: Array<{ kind: "youtube" | "upload"; youtube_id: string | null; media_id: string | null; title: string | null }> = [];
  for (const v of videos) {
    if (v.kind === "youtube") {
      const ytId = parseYouTubeId(v.url);
      if (!ytId) throw new ValidationError(`"${v.url}" is not a valid YouTube link.`);
      prepared.push({ kind: "youtube", youtube_id: ytId, media_id: null, title: v.title ?? null });
    } else {
      const m: { id: string; type: string; active: number | boolean } | undefined = await db("media").where({ id: v.mediaId }).first("id", "type", "active");
      if (!m) throw new ValidationError("The selected video was not found in the Media Library.");
      if (m.type !== "video") throw new ValidationError("Only video media can be attached as an uploaded product video.");
      if (!m.active) throw new ValidationError("An inactive Media Library item cannot be used.");
      prepared.push({ kind: "upload", youtube_id: null, media_id: v.mediaId, title: v.title ?? null });
    }
  }
  await db.transaction(async (trx) => {
    await trx(VIDEOS).where({ product_id: productId }).delete();
    for (let i = 0; i < prepared.length; i++) {
      await trx(VIDEOS).insert({ id: randomUUID(), product_id: productId, sort_order: i, ...prepared[i]! });
    }
  });
  return getAdminShopProduct(productId);
}
