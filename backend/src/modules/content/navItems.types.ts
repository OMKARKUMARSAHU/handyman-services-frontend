export interface NavItemRow {
  id: string;
  label: string;
  href: string;
  sort_order: number;
}

export interface NavItemDto {
  id: string;
  label: string;
  href: string;
  sortOrder: number;
}

export function toNavItemDto(row: NavItemRow): NavItemDto {
  return { id: row.id, label: row.label, href: row.href, sortOrder: row.sort_order };
}
