export interface ServiceTypeDto {
  id: string;
  key: string;
  label: string;
  sortOrder: number;
  active: boolean;
}

export interface ServiceTypeRow {
  id: string;
  key: string;
  label: string;
  sort_order: number;
  active: number | boolean;
}

export function toServiceTypeDto(row: ServiceTypeRow): ServiceTypeDto {
  return { id: row.id, key: row.key, label: row.label, sortOrder: row.sort_order, active: Boolean(row.active) };
}
