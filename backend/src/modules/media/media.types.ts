// MEDIA LIBRARY FOLLOW-UP: `media_type` distinguishes a photo from a video
// in a service's gallery (previously every row was implicitly an image).
// `media_id` links back to a shared `media` (Media Library) row when this
// image/video was attached via the central picker -- null for anything
// attached the original, direct-upload way. Both default-safe for every
// pre-existing row (see the migration's doc comment).
export interface ServiceImageRow {
  id: string;
  service_id: string;
  url: string;
  alt: string;
  sort_order: number;
  media_type: "image" | "video";
  media_id: string | null;
}

export interface ServiceImageDto {
  id: string;
  serviceId: string;
  url: string;
  alt: string;
  sortOrder: number;
  mediaType: "image" | "video";
  mediaId: string | null;
}

export function toServiceImageDto(row: ServiceImageRow): ServiceImageDto {
  return {
    id: row.id,
    serviceId: row.service_id,
    url: row.url,
    alt: row.alt,
    sortOrder: row.sort_order,
    mediaType: row.media_type,
    mediaId: row.media_id,
  };
}
