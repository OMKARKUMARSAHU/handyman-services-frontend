export interface ServiceImageRow {
  id: string;
  service_id: string;
  url: string;
  alt: string;
  sort_order: number;
}

export interface ServiceImageDto {
  id: string;
  serviceId: string;
  url: string;
  alt: string;
  sortOrder: number;
}

export function toServiceImageDto(row: ServiceImageRow): ServiceImageDto {
  return { id: row.id, serviceId: row.service_id, url: row.url, alt: row.alt, sortOrder: row.sort_order };
}
