import { z } from "zod";

/** Canonical stored form of a Media Library file: exactly what buildPublicUrl() returns and what media.url holds. */
export const MEDIA_FILE_PATH_PREFIX = "/api/backend/media/file/";

// key shapes produced by the backend: library/<type>/<uuid>-<name>, services/<id>/<uuid>-<name>, cms/<entity>/<uuid>-<name>;
// file names are sanitized to [A-Za-z0-9._-] by sanitizeFileName().
const CANONICAL_MEDIA_PATH = /^\/api\/backend\/media\/file\/(?:library|services|cms)(?:\/[A-Za-z0-9._-]+)+$/;
// Same pattern migration 20260101000018 used to recognise this backend's own absolute media URLs.
const OWN_ABSOLUTE_MEDIA_URL = /^https?:\/\/[^/]+(?:\/[^?#]*)?\/media\/file\/((?:library|services|cms)(?:\/[A-Za-z0-9._-]+)+)$/;

export function isCanonicalMediaPath(value: string): boolean {
  return CANONICAL_MEDIA_PATH.test(value) && !value.split("/").some((seg) => seg === "." || seg === "..");
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Value for the `image` / `icon_url` columns that hold a media URL (varchar(500)).
 * Accepts (1) the canonical Media Library path, or (2) an absolute http(s) URL.
 * An absolute URL that is really this backend's own /media/file/<key> route is
 * rewritten to the canonical path, so media.url equality (used by the delete
 * protection in findMediaReferences) always holds. Anything else is rejected.
 */
export const mediaUrlSchema = z
  .string()
  .max(500)
  .superRefine((value, ctx) => {
    if (isCanonicalMediaPath(value) || isHttpUrl(value)) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Must be an http(s) URL or a Media Library path starting with ${MEDIA_FILE_PATH_PREFIX}`,
    });
  })
  .transform((value) => {
    const own = value.match(OWN_ABSOLUTE_MEDIA_URL);
    return own ? `${MEDIA_FILE_PATH_PREFIX}${own[1]}` : value;
  });

/** For delete: the S3 key to remove. Uses the row's own s3_key (never re-derived from the URL). */
export function s3KeyForDelete(row: { s3_key: string }): string | null {
  const key = row.s3_key;
  if (!/^(?:library|services|cms)(?:\/[A-Za-z0-9._-]+)+$/.test(key)) return null;
  if (key.split("/").some((seg) => seg === "." || seg === "..")) return null;
  return key;
}
