export type MediaType = "image" | "video";

export interface MediaRow {
  id: string;
  type: MediaType;
  s3_key: string;
  url: string;
  mime_type: string;
  original_filename: string;
  file_size_bytes: number;
  title: string | null;
  seo_title: string | null;
  alt_text: string | null;
  description: string | null;
  active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface MediaDto {
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

export function toMediaDto(row: MediaRow): MediaDto {
  return {
    id: row.id,
    type: row.type,
    url: row.url,
    mimeType: row.mime_type,
    originalFilename: row.original_filename,
    fileSizeBytes: Number(row.file_size_bytes),
    title: row.title,
    seoTitle: row.seo_title,
    altText: row.alt_text,
    description: row.description,
    active: Boolean(row.active),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/** One place a media item is in use, surfaced by `findMediaReferences` so a delete can be blocked with a human-readable reason instead of silently breaking whatever it's attached to. */
export interface MediaReference {
  entityType: string;
  entityId: string;
  label: string;
}
