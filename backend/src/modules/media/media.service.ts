import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
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

/**
 * MEDIA FIX FOLLOW-UP ("broken thumbnails" root cause): this bucket has
 * Block Public Access fully ON and no bucket policy, by design
 * (PHASE_4_BACKEND_AWS_INFRASTRUCTURE_PLAN.md §9 -- "public access block
 * stays exactly as-is, not relaxed"). The bucket's own
 * `https://<bucket>.s3.<region>.amazonaws.com/<key>` URL this function used
 * to return is therefore NEVER actually fetchable by a browser -- every
 * `<img>`/`<video>` pointed at it was always going to 403, which is exactly
 * the broken-thumbnail symptom. Rather than relaxing Block Public Access
 * (explicitly out of bounds), this now returns a stable URL on this
 * backend's own GET /media/file/<key> route (added below in this file /
 * registered in media.routes.ts), which presigns a short-lived GET and
 * 302-redirects to it fresh on every request -- the bucket stays fully
 * private; only a request carrying a valid, freshly-minted signature ever
 * reaches an object.
 *
 * This is the ONE place every caller that builds a storable image/video
 * URL goes through -- `attachServiceImage`'s key-based path, `createCmsUploadUrl`
 * (category/product/city/offer/homepage images, used by
 * `uploadCmsFile()` on the frontend), and the Media Library's `createMedia`
 * -- so fixing it here fixes every surface without touching any of those
 * call sites.
 */
export function buildPublicUrl(key: string): string {
  requireBucketName(); // keep the "is S3 actually configured" guard
  // PHASE 16 -- the EB environment this backend runs on has no HTTPS/TLS
  // listener (see src/app/api/backend/[...path]/route.ts on the frontend
  // for the full writeup of that limitation). An absolute
  // `${API_PUBLIC_BASE_URL}` URL is therefore either an http:// origin
  // (blocked as mixed content on the https:// frontend) or an https://
  // one (nothing listens on 443 -- connection just times out), so EVERY
  // absolute URL built here is unreachable from a browser regardless of
  // hostname correctness. Returning a site-relative path instead routes
  // the browser's image/video request back through the frontend's own
  // already-working same-origin proxy (`/api/backend/*` ->
  // DIRECT_BACKEND_BASE_URL), exactly like every other browser-side API
  // call already does. Do not reintroduce an absolute, host-qualified
  // URL here without first giving EB a real HTTPS listener.
  //
  // PHASE 16 CORRECTION (caught in local testing): do NOT prefix with
  // `env.API_BASE_PATH` here. Every other browser-side call in this
  // codebase (see request()/apiRequest() in src/lib/auth/api.ts) builds
  // its proxy path as `${BROWSER_PROXY_BASE_PATH}${barePath}` with NO
  // `/api/v1` segment, because the proxy route
  // (src/app/api/backend/[...path]/route.ts) forwards
  // `${DIRECT_BACKEND_BASE_URL}/${path}` and DIRECT_BACKEND_BASE_URL
  // ALREADY ends in `/api/v1`. Including API_BASE_PATH here too produced
  // `/api/backend/api/v1/media/file/<key>`, which the proxy turned into
  // `.../api/v1/api/v1/media/file/<key>` -- a double-prefixed path that
  // 404s on the real backend route (`/api/v1/media/file/<key>`). The
  // first version of this fix was verified against a hand-typed test
  // URL that happened to omit this prefix, then shipped with the bug
  // anyway -- exactly why this needed a real local end-to-end test
  // before going out again.
  return `/api/backend/media/file/${key}`;
}

/**
 * Used by the GET /media/file/<key> route (media.routes.ts) that
 * buildPublicUrl() above now points every stored media URL at. A fresh
 * presigned GET is minted on every request -- never stored -- so the
 * link embedded in a `<img src>`/`<video src>` never itself expires (the
 * browser re-requests this backend route each time, which always hands
 * back a currently-valid redirect).
 */
export async function createMediaFileRedirectUrl(key: string): Promise<string> {
  const bucket = requireBucketName();
  return getSignedUrl(getS3Client(), new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: env.S3_UPLOAD_URL_TTL_SECONDS,
  });
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
