import { randomUUID } from "node:crypto";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env";
import { getDb } from "../../database/db";
import { ConflictError, NotFoundError } from "../../shared/errors";
import {
  ALLOWED_MEDIA_CONTENT_TYPES,
  buildPublicUrl,
  getS3Client,
  requireBucketName,
  sanitizeFileName,
} from "../media/media.service";
import { toMediaDto, type MediaDto, type MediaReference, type MediaRow, type MediaType } from "./media-library.types";

const TABLE = "media";

function inferMediaType(contentType: string): MediaType {
  return contentType.startsWith("video/") ? "video" : "image";
}

/**
 * Central Media Library — Admin-only presigned upload, step 1 of 2 (see
 * `createMedia` for step 2). Deliberately a separate S3 prefix
 * (`library/...`) from both the per-service prefix (`services/<id>/...`)
 * and the older per-entity-type CMS prefix (`cms/<entityType>/...`) in
 * `../media/media.service.ts` — this is the new shared pool every one of
 * those is meant to draw from going forward, so it gets its own
 * namespace rather than overlapping either.
 */
export async function createLibraryUploadUrl(input: {
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
}): Promise<{ uploadUrl: string; key: string; expiresAt: string }> {
  if (!ALLOWED_MEDIA_CONTENT_TYPES.has(input.contentType)) {
    throw new ConflictError(
      `Unsupported content type "${input.contentType}". Allowed types: ${[...ALLOWED_MEDIA_CONTENT_TYPES].join(", ")}.`
    );
  }

  const type = inferMediaType(input.contentType);
  // VIDEO SHOWCASE ADMIN FIX: videos get their own, much larger ceiling
  // (env.ts has the full rationale) -- the single shared image-sized cap
  // this used to enforce for every content type made uploading a real
  // video effectively impossible.
  const maxBytes = type === "video" ? env.S3_MAX_VIDEO_UPLOAD_BYTES : env.S3_MAX_UPLOAD_BYTES;
  if (input.fileSizeBytes > maxBytes) {
    const maxMb = (maxBytes / (1024 * 1024)).toFixed(0);
    const gotMb = (input.fileSizeBytes / (1024 * 1024)).toFixed(1);
    throw new ConflictError(
      `This ${type} is ${gotMb}MB, which is over the ${maxMb}MB limit for ${type} uploads.`
    );
  }

  const bucket = requireBucketName();
  const key = `library/${type}/${randomUUID()}-${sanitizeFileName(input.fileName)}`;

  const uploadUrl = await getSignedUrl(
    getS3Client(),
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: input.contentType }),
    { expiresIn: env.S3_UPLOAD_URL_TTL_SECONDS }
  );

  return {
    uploadUrl,
    key,
    expiresAt: new Date(Date.now() + env.S3_UPLOAD_URL_TTL_SECONDS * 1000).toISOString(),
  };
}

/**
 * Step 2: called by the browser after its direct-to-S3 PUT succeeds, to
 * record the resulting object as a library row. Metadata
 * (title/seoTitle/altText/description) is entirely optional — the upload
 * succeeds with none of it set, per the explicit requirement that an
 * admin must be able to upload without entering metadata.
 */
export async function createMedia(input: {
  key: string;
  mimeType: string;
  originalFilename: string;
  fileSizeBytes: number;
  title?: string;
  seoTitle?: string;
  altText?: string;
  description?: string;
}): Promise<MediaDto> {
  const id = randomUUID();
  await getDb()<MediaRow>(TABLE).insert({
    id,
    type: inferMediaType(input.mimeType),
    s3_key: input.key,
    // Recomputed server-side from the key rather than trusting a
    // client-supplied URL — this table (unlike the plain string columns
    // on categories/products/etc.) is the Library's own source of truth.
    url: buildPublicUrl(input.key),
    mime_type: input.mimeType,
    original_filename: input.originalFilename,
    file_size_bytes: input.fileSizeBytes,
    title: input.title ?? null,
    seo_title: input.seoTitle ?? null,
    alt_text: input.altText ?? null,
    description: input.description ?? null,
    active: true,
  });
  const row = await getDb()<MediaRow>(TABLE).where({ id }).first();
  if (!row) throw new Error("Failed to read back created media.");
  return toMediaDto(row);
}

export async function listMedia(params: {
  type?: MediaType;
  search?: string;
  activeOnly?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<{ items: MediaDto[]; total: number; page: number; pageSize: number }> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 24;

  let query = getDb()<MediaRow>(TABLE);
  if (params.type) query = query.where({ type: params.type });
  if (params.activeOnly) query = query.where({ active: true });
  if (params.search) {
    const term = `%${params.search}%`;
    query = query.where((qb) => {
      qb.whereILike("title", term)
        .orWhereILike("original_filename", term)
        .orWhereILike("alt_text", term)
        .orWhereILike("seo_title", term);
    });
  }

  const totalRow = await query.clone().count<{ count: string }[]>({ count: "*" }).first();
  const total = Number(totalRow?.count ?? 0);

  const rows = await query
    .clone()
    .orderBy("created_at", "desc")
    .offset((page - 1) * pageSize)
    .limit(pageSize);

  return { items: rows.map(toMediaDto), total, page, pageSize };
}

export async function getMediaById(id: string): Promise<MediaDto> {
  const row = await getDb()<MediaRow>(TABLE).where({ id }).first();
  if (!row) throw new NotFoundError("Media not found.");
  return toMediaDto(row);
}

export async function updateMedia(
  id: string,
  patch: { title?: string | null; seoTitle?: string | null; altText?: string | null; description?: string | null; active?: boolean }
): Promise<MediaDto> {
  const existing = await getDb()<MediaRow>(TABLE).where({ id }).first();
  if (!existing) throw new NotFoundError("Media not found.");

  const dbPatch: Partial<MediaRow> = {};
  if ("title" in patch) dbPatch.title = patch.title ?? null;
  if ("seoTitle" in patch) dbPatch.seo_title = patch.seoTitle ?? null;
  if ("altText" in patch) dbPatch.alt_text = patch.altText ?? null;
  if ("description" in patch) dbPatch.description = patch.description ?? null;
  if ("active" in patch) dbPatch.active = patch.active;

  if (Object.keys(dbPatch).length > 0) {
    await getDb()<MediaRow>(TABLE).where({ id }).update(dbPatch);
  }
  return getMediaById(id);
}

/**
 * Scans every place a media item's URL (or, for `service_images`, its
 * `media_id` FK) could be in use, so `deleteMedia` can refuse to delete
 * something that's still attached somewhere instead of silently breaking
 * a service gallery, a category card, or a homepage section — the
 * explicit "do not allow an accidental deletion to silently break
 * [something]" requirement.
 *
 * Deliberately checks by URL for the plain-string-column entities
 * (categories/products/cities/offers/homepage_sections/testimonials/
 * branding) rather than via a generic attachments table: those tables'
 * schemas are untouched by this feature (see the migration's doc
 * comment), so a direct, always-accurate URL match is simpler and can
 * never drift out of sync the way a separately-maintained attachment
 * record could.
 */
export async function findMediaReferences(media: MediaDto): Promise<MediaReference[]> {
  const db = getDb();
  const refs: MediaReference[] = [];

  const serviceImages: Array<{ id: string; service_id: string }> = await db("service_images")
    .select("id", "service_id")
    .where({ media_id: media.id });
  for (const row of serviceImages) {
    refs.push({ entityType: "service", entityId: row.service_id, label: `Service image/video (row ${row.id})` });
  }

  const categories: Array<{ id: string; name: string }> = await db("categories").select("id", "name").where({ image: media.url });
  for (const row of categories) refs.push({ entityType: "category", entityId: row.id, label: `Category "${row.name}"` });

  const products: Array<{ id: string; name: string }> = await db("products").select("id", "name").where({ image: media.url });
  for (const row of products) refs.push({ entityType: "product", entityId: row.id, label: `Product "${row.name}"` });

  const cities: Array<{ id: string; name: string }> = await db("cities").select("id", "name").where({ icon_url: media.url });
  for (const row of cities) refs.push({ entityType: "city", entityId: row.id, label: `City "${row.name}"` });

  const offers: Array<{ id: string; title: string }> = await db("offers").select("id", "title").where({ banner_image: media.url });
  for (const row of offers) refs.push({ entityType: "offer", entityId: row.id, label: `Offer "${row.title}"` });

  const testimonials: Array<{ id: string; name: string }> = await db("testimonials")
    .select("id", "name")
    .where({ photo: media.url });
  for (const row of testimonials) refs.push({ entityType: "testimonial", entityId: row.id, label: `Testimonial — ${row.name}` });

  // homepage_sections: the `image` column is a direct match; `items` is a
  // free-form JSON array (video-curation thumbnail/videoUrl, or any other
  // section's per-item image) so it's searched in application code rather
  // than with a database-specific JSON operator.
  const sections: Array<{ key: string; heading: string; image: string | null; items: unknown }> = await db("homepage_sections").select(
    "key",
    "heading",
    "image",
    "items"
  );
  for (const section of sections) {
    if (section.image === media.url) {
      refs.push({ entityType: "homepage_section", entityId: section.key, label: `Homepage section "${section.heading}"` });
      continue;
    }
    const items = Array.isArray(section.items) ? section.items : [];
    const matches = items.some(
      (item) => typeof item === "object" && item !== null && Object.values(item).some((v) => v === media.url)
    );
    if (matches) {
      refs.push({ entityType: "homepage_section", entityId: section.key, label: `Homepage section "${section.heading}" (an item)` });
    }
  }

  const branding: { id: string; logo_url: string | null; brand_assets: unknown } | undefined = await db("branding")
    .select("id", "logo_url", "brand_assets")
    .first();
  if (branding) {
    const assets = Array.isArray(branding.brand_assets) ? branding.brand_assets : [];
    const assetMatch = assets.some((a) => typeof a === "object" && a !== null && Object.values(a).some((v) => v === media.url));
    if (branding.logo_url === media.url || assetMatch) {
      refs.push({ entityType: "branding", entityId: branding.id, label: "Site branding (logo/brand asset)" });
    }
  }

  return refs;
}

/**
 * Refuses to delete a still-referenced media item (see
 * `findMediaReferences`'s doc comment) — the caller should offer
 * `updateMedia(id, { active: false })` instead when that happens, which
 * hides it from the picker without touching whatever currently uses it.
 * Only deletes the underlying S3 object when nothing references the row
 * (best-effort, same as the existing per-service image delete).
 */
export async function deleteMedia(id: string): Promise<void> {
  const media = await getMediaById(id);
  const references = await findMediaReferences(media);
  if (references.length > 0) {
    throw new ConflictError(
      `This media item is still attached in ${references.length} place(s) and can't be deleted. Remove it from those first, or deactivate it instead.`,
      { references }
    );
  }

  await getDb()<MediaRow>(TABLE).where({ id }).delete();

  try {
    const bucket = requireBucketName();
    const key = new URL(media.url).pathname.replace(/^\//, "");
    await getS3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch {
    // Best-effort: the MySQL row (source of truth for the library) is
    // already gone; a leftover S3 object is a cleanup-job concern.
  }
}
