import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env";
import { getDb } from "../../database/db";
import { ConflictError, ForbiddenError, NotFoundError } from "../../shared/errors";
import type { AuthenticatedUser } from "../auth/types";
import { getManagedServiceById } from "../services/services.service";
import { toServiceImageDto, type ServiceImageDto, type ServiceImageRow } from "./media.types";

const TABLE = "service_images";

/**
 * JPEG/PNG/WebP images per PHASE_2_AWS_ARCHITECTURE.md §15 ("Image
 * storage"), plus mp4 for the "video" media the same section allows for.
 * Intentionally a single shared size cap (`S3_MAX_UPLOAD_BYTES`) rather than
 * per-type limits — the approved doc only gives an illustrative "a few MB
 * for images, larger for video" without fixing real numbers, so a
 * differentiated cap would be an invented, unconfirmed detail; flagged as a
 * simplification in PHASE_3_BACKEND_IMPLEMENTATION.md, not silently assumed.
 */
// MEDIA LIBRARY FOLLOW-UP: exported (and renamed from the original
// module-private ALLOWED_CONTENT_TYPES) so the new central Media Library
// module (../media-library/media-library.service.ts) validates uploads
// against the exact same allow-list instead of maintaining a second,
// potentially-drifting copy. Extended with gif/webm/quicktime per the
// Media Library's "do not unnecessarily restrict formats" requirement --
// S3 storage doesn't care about the format, so the only real constraint
// is sensible validation, not an arbitrarily narrow allow-list.
export const ALLOWED_MEDIA_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

// Back-compat alias -- every existing call site in this file keeps working unchanged.
const ALLOWED_CONTENT_TYPES = ALLOWED_MEDIA_CONTENT_TYPES;

let s3Client: S3Client | null = null;

/**
 * Built lazily so a sandbox/dev environment with no real S3 bucket
 * configured doesn't crash at import time — only when an upload is actually
 * requested. In production (ECS Fargate) `AWS_ACCESS_KEY_ID`/`_SECRET_` are
 * never set, so the SDK's default provider chain resolves credentials from
 * the task's IAM role instead; the explicit branch below exists only so
 * local development and tests can presign without a real IAM role
 * available, exactly as `.env.example` documents.
 */
// MEDIA LIBRARY FOLLOW-UP: exported so ../media-library/media-library.service.ts
// reuses this exact client/credential-resolution logic instead of a second copy.
export function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: env.S3_REGION,
      ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
        ? { credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY } }
        : {}),
    });
  }
  return s3Client;
}

// MEDIA LIBRARY FOLLOW-UP: exported, same reasoning as getS3Client above.
export function requireBucketName(): string {
  if (!env.S3_BUCKET_NAME) {
    throw new Error(
      "S3_BUCKET_NAME is not configured — cannot broker a media upload. Set it in the environment before handling media requests."
    );
  }
  return env.S3_BUCKET_NAME;
}

// MEDIA LIBRARY FOLLOW-UP: exported, same reasoning as getS3Client above.
export function buildPublicUrl(key: string): string {
  const bucket = requireBucketName();
  return `https://${bucket}.s3.${env.S3_REGION}.amazonaws.com/${key}`;
}

// MEDIA LIBRARY FOLLOW-UP: exported, same reasoning as getS3Client above.
export function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
}

/**
 * Backend-brokered pre-signed upload flow (PHASE_2_AWS_ARCHITECTURE.md §15):
 * the browser never receives an AWS credential — only a short-lived,
 * single-object pre-signed PUT URL, issued after the exact same
 * role/ownership/approval-status/MIME/size checks every other media
 * mutation on this listing goes through.
 */
export async function createUploadUrl(
  auth: AuthenticatedUser,
  input: { serviceId: string; fileName: string; contentType: string; fileSizeBytes: number }
): Promise<{ uploadUrl: string; key: string; expiresAt: string }> {
  if (!ALLOWED_CONTENT_TYPES.has(input.contentType)) {
    throw new ConflictError(
      `Unsupported content type "${input.contentType}". Allowed types: ${[...ALLOWED_CONTENT_TYPES].join(", ")}.`
    );
  }
  if (input.fileSizeBytes > env.S3_MAX_UPLOAD_BYTES) {
    throw new ConflictError(`File is too large. Maximum allowed size is ${env.S3_MAX_UPLOAD_BYTES} bytes.`);
  }

  const service = await getManagedServiceById(input.serviceId);
  if (!service) throw new NotFoundError("Service not found.");
  assertCanManageServiceMedia(service, auth);

  const bucket = requireBucketName();
  // Separate logical prefix per entity type (PHASE_3 brief) — service media never shares a
  // prefix with any other entity type's uploads (homepage banners, branding assets, etc.).
  const key = `services/${input.serviceId}/${randomUUID()}-${sanitizeFileName(input.fileName)}`;

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
 * Called by the browser after its direct-to-S3 upload succeeds, to record
 * the resulting key as a `service_images` row. Never receives raw file
 * bytes itself.
 *
 * MEDIA LIBRARY FOLLOW-UP: `input` now accepts EITHER `key` (the original,
 * still-fully-supported path -- a file just PUT directly to a fresh,
 * service-scoped S3 key via `createUploadUrl` above) OR `mediaId` (the new
 * path -- the file already exists as a Media Library row, selected or
 * just-uploaded through the central picker). Exactly one of the two is
 * required (enforced by `attachImageSchema`'s `.refine()`). When `mediaId`
 * is given, the resulting `service_images` row's `media_id` links back to
 * that shared row -- this is what lets `deleteServiceImage` below avoid
 * ever deleting a library-owned, possibly-shared S3 object, and what lets
 * the Media Library's own delete refuse to remove something still attached
 * to a service (`media-library.service.ts`'s `findMediaReferences`).
 */
export async function attachServiceImage(
  auth: AuthenticatedUser,
  serviceId: string,
  input: { key?: string; mediaId?: string; alt: string; sortOrder?: number; mediaType?: "image" | "video" }
): Promise<ServiceImageDto> {
  const service = await getManagedServiceById(serviceId);
  if (!service) throw new NotFoundError("Service not found.");
  assertCanManageServiceMedia(service, auth);

  let url: string;
  let mediaId: string | null = null;
  let mediaType: "image" | "video" = input.mediaType ?? "image";

  if (input.mediaId) {
    const media = await getDb()<{ id: string; url: string; type: "image" | "video" }>("media")
      .where({ id: input.mediaId })
      .first();
    if (!media) throw new NotFoundError("Media not found.");
    url = media.url;
    mediaId = media.id;
    mediaType = media.type;
  } else if (input.key) {
    url = buildPublicUrl(input.key);
  } else {
    throw new ConflictError("Provide either a key or a mediaId.");
  }

  const id = randomUUID();
  await getDb()<ServiceImageRow>(TABLE).insert({
    id,
    service_id: serviceId,
    url,
    alt: input.alt,
    sort_order: input.sortOrder ?? 0,
    media_type: mediaType,
    media_id: mediaId,
  });
  const row = await getDb()<ServiceImageRow>(TABLE).where({ id }).first();
  if (!row) throw new Error("Failed to read back created service image.");
  return toServiceImageDto(row);
}

/**
 * ADMIN CMS FOLLOW-UP ("Reorder images / Set primary image"): the only way
 * to change an existing image's position used to be delete-and-re-upload,
 * which loses the file. This updates the row in place -- same
 * ownership/approval-status gate as every other media mutation.
 */
export async function updateServiceImage(
  auth: AuthenticatedUser,
  imageId: string,
  input: { sortOrder?: number; alt?: string }
): Promise<ServiceImageDto> {
  const found = await getImageWithService(imageId);
  if (!found) throw new NotFoundError("Image not found.");
  assertCanManageServiceMedia(found.service, auth);

  const patch: Partial<ServiceImageRow> = {};
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  if (input.alt !== undefined) patch.alt = input.alt;
  // (sortOrder/alt only -- media_type is fixed at attach time, by design.)

  if (Object.keys(patch).length > 0) {
    await getDb()<ServiceImageRow>(TABLE).where({ id: imageId }).update(patch);
  }
  const row = await getDb()<ServiceImageRow>(TABLE).where({ id: imageId }).first();
  if (!row) throw new Error("Failed to read back updated service image.");
  return toServiceImageDto(row);
}

/** Used by `requireOwnership()`-style checks and the delete route — resolves which service an image row belongs to. */
async function getImageWithService(imageId: string) {
  const image = await getDb()<ServiceImageRow>(TABLE).where({ id: imageId }).first();
  if (!image) return null;
  const service = await getManagedServiceById(image.service_id);
  return service ? { image, service } : null;
}

/**
 * Deletes the `service_images` row. Whether the underlying S3 object is
 * deleted immediately or garbage-collected later is left as a Phase 3
 * implementation detail per the approved AWS doc — this best-effort deletes
 * the S3 object too (never blocking the MySQL row deletion on it), rather
 * than leaving every removed image as an orphaned, unreferenced object.
 *
 * MEDIA LIBRARY FOLLOW-UP: that S3-delete is now conditional on
 * `media_id` being unset. A row with `media_id` set came from the central
 * Media Library -- its S3 object may be attached elsewhere (another
 * service, a category image, a homepage section), so only the
 * `service_images` row (the attachment) is removed here; the shared
 * media/S3 object's own lifecycle belongs to the Media Library's own
 * delete endpoint, which checks for exactly this kind of reference
 * before ever touching S3 (see media-library.service.ts's
 * `findMediaReferences`). A row with no `media_id` (attached the old,
 * direct-upload way) keeps today's exact behavior.
 */
export async function deleteServiceImage(auth: AuthenticatedUser, imageId: string): Promise<void> {
  const found = await getImageWithService(imageId);
  if (!found) throw new NotFoundError("Image not found.");
  assertCanManageServiceMedia(found.service, auth);

  await getDb()<ServiceImageRow>(TABLE).where({ id: imageId }).delete();

  if (found.image.media_id) return;

  try {
    const bucket = requireBucketName();
    const key = new URL(found.image.url).pathname.replace(/^\//, "");
    await getS3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch {
    // Best-effort: the MySQL row (the source of truth for what's "attached" to a
    // listing) is already gone; a leftover S3 object is a cleanup-job concern, not
    // a reason to fail this request or leave the row/S3 state inconsistent.
  }
}

/**
 * Generic, non-service-scoped presigned upload for Admin CMS content —
 * category/product/city icons & photos, offer banner images, homepage
 * section images, video-curation thumbnails/clips, branding assets. Unlike
 * `createUploadUrl` above (service-image-gallery specific, inserts a
 * `service_images` row), this never touches the database: it only hands
 * back a presigned PUT URL plus the public URL the caller then saves onto
 * whichever entity field it belongs to (e.g. `PATCH /admin/categories/:id
 * { image: publicUrl }`), via that entity's own already-existing admin
 * endpoint. Admin-only (enforced in the route) since every caller of this
 * is an Admin-only content-management surface.
 */
export async function createCmsUploadUrl(input: {
  entityType: string;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
}): Promise<{ uploadUrl: string; key: string; publicUrl: string; expiresAt: string }> {
  if (!ALLOWED_CONTENT_TYPES.has(input.contentType)) {
    throw new ConflictError(
      `Unsupported content type "${input.contentType}". Allowed types: ${[...ALLOWED_CONTENT_TYPES].join(", ")}.`
    );
  }
  if (input.fileSizeBytes > env.S3_MAX_UPLOAD_BYTES) {
    throw new ConflictError(`File is too large. Maximum allowed size is ${env.S3_MAX_UPLOAD_BYTES} bytes.`);
  }

  const bucket = requireBucketName();
  const safeEntityType = input.entityType.replace(/[^a-z0-9-]/gi, "-").slice(0, 40) || "misc";
  const key = `cms/${safeEntityType}/${randomUUID()}-${sanitizeFileName(input.fileName)}`;

  const uploadUrl = await getSignedUrl(
    getS3Client(),
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: input.contentType }),
    { expiresIn: env.S3_UPLOAD_URL_TTL_SECONDS }
  );

  return {
    uploadUrl,
    key,
    publicUrl: buildPublicUrl(key),
    expiresAt: new Date(Date.now() + env.S3_UPLOAD_URL_TTL_SECONDS * 1000).toISOString(),
  };
}

/**
 * Admin manages media on any listing, regardless of its approval status.
 * A Provider may only manage media on their OWN listing, and only while it
 * is `pending_approval` or `rejected` — never on an already-`approved` one
 * (PHASE_2_BACKEND_API_CONTRACT.md §MEDIA: "for their own pending/rejected
 * listing only"), so a Provider can never silently change a live listing's
 * images without going back through the approval queue.
 */
function assertCanManageServiceMedia(
  service: { id: string; createdByRole: string; createdByUserId: string; approvalStatus: string },
  auth: AuthenticatedUser
): void {
  if (auth.role === "admin") return;
  if (auth.role !== "provider" || service.createdByRole !== "provider" || service.createdByUserId !== auth.sub) {
    throw new ForbiddenError("You do not own this listing.");
  }
  if (service.approvalStatus === "approved") {
    throw new ConflictError("Providers may only manage media on a pending or rejected listing, not an approved one.");
  }
}
