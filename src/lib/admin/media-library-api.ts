import { apiRequest, AuthApiError } from "@/lib/auth/api";

export { AuthApiError };

/**
 * Central Media Library — typed client for `/admin/media-library/*`
 * (backend/src/modules/media-library). This is the new, single source of
 * truth every Admin image/video upload location is meant to go through
 * (the "Media" sidebar tab's own management screen, and the shared
 * `MediaPicker` component other Admin forms embed) — see
 * `src/components/account/MediaPicker.tsx` and
 * `src/components/account/AdminMediaLibraryPanel.tsx`.
 */

export type MediaType = "image" | "video";

export interface Media {
  id: string;
  type: MediaType;
  url: string;
  mimeType: string;
  originalFilename: string;
  fileSizeBytes: number;
  title: string | null;
  seoTitle: string | null;
  altText: string | null;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MediaReference {
  entityType: string;
  entityId: string;
  label: string;
}

export interface MediaMetadataInput {
  title?: string;
  seoTitle?: string;
  altText?: string;
  description?: string;
}

/** Accepted upload formats — kept in sync with the backend's ALLOWED_MEDIA_CONTENT_TYPES (media.service.ts). */
export const ACCEPTED_MEDIA_TYPES =
  "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime";

export function listMedia(
  params: { type?: MediaType; search?: string; activeOnly?: boolean; page?: number; pageSize?: number } = {}
): Promise<{ items: Media[]; total: number; page: number; pageSize: number }> {
  const query = new URLSearchParams();
  if (params.type) query.set("type", params.type);
  if (params.search) query.set("search", params.search);
  if (params.activeOnly !== undefined) query.set("activeOnly", String(params.activeOnly));
  query.set("page", String(params.page ?? 1));
  query.set("pageSize", String(params.pageSize ?? 24));
  return apiRequest(`/admin/media-library?${query.toString()}`, { method: "GET" });
}

export function getMedia(id: string): Promise<Media> {
  return apiRequest(`/admin/media-library/${id}`, { method: "GET" });
}

function createLibraryUploadUrl(input: {
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
}): Promise<{ uploadUrl: string; key: string; expiresAt: string }> {
  return apiRequest("/admin/media-library/upload-url", { method: "POST", body: JSON.stringify(input) });
}

function createMediaRecord(input: {
  key: string;
  mimeType: string;
  originalFilename: string;
  fileSizeBytes: number;
  title?: string;
  seoTitle?: string;
  altText?: string;
  description?: string;
}): Promise<Media> {
  return apiRequest("/admin/media-library", { method: "POST", body: JSON.stringify(input) });
}

/**
 * Uploads one file to S3 through the Library's presign flow and records
 * it, in one call. Metadata is entirely optional — the explicit
 * requirement that an admin can upload a photo/video without entering
 * any title/SEO/alt/description.
 */
export async function uploadMedia(file: File, metadata: MediaMetadataInput = {}): Promise<Media> {
  const { uploadUrl, key } = await createLibraryUploadUrl({
    fileName: file.name,
    contentType: file.type,
    fileSizeBytes: file.size,
  });
  let putRes: Response;
  try {
    putRes = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
  } catch {
    // The backend presign call succeeded, but the direct browser->S3 PUT
    // never got a response at all -- most commonly the bucket's CORS
    // configuration doesn't allow this origin yet, or the link expired.
    throw new Error(
      "Could not reach storage to upload this file. If this keeps happening, the S3 bucket's CORS configuration may need to allow this site's origin."
    );
  }
  if (!putRes.ok) throw new Error(`Upload to storage failed (${putRes.status}).`);
  return createMediaRecord({
    key,
    mimeType: file.type,
    originalFilename: file.name,
    fileSizeBytes: file.size,
    ...metadata,
  });
}

export function updateMedia(
  id: string,
  patch: MediaMetadataInput & { active?: boolean }
): Promise<Media> {
  return apiRequest(`/admin/media-library/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

/**
 * Throws a `MediaInUseError` (409, carrying the reference list) when the
 * backend refuses because the item is still attached somewhere — callers
 * should catch that specifically and offer `updateMedia(id, {active:
 * false})` instead of a hard delete.
 */
export async function deleteMedia(id: string): Promise<{ success: boolean }> {
  try {
    return await apiRequest(`/admin/media-library/${id}`, { method: "DELETE" });
  } catch (err) {
    if (err instanceof AuthApiError && err.status === 409) {
      const references = (err.details as { references?: MediaReference[] } | undefined)?.references ?? [];
      throw new MediaInUseError(err.message, references);
    }
    throw err;
  }
}

export class MediaInUseError extends Error {
  readonly references: MediaReference[];
  constructor(message: string, references: MediaReference[]) {
    super(message);
    this.name = "MediaInUseError";
    this.references = references;
  }
}
