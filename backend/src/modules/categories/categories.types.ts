export interface CategoryDto {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  image: string | null;
  sortOrder: number;
  active: boolean;
}

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  image: string | null;
  sort_order: number;
  active: number | boolean;
}

export function toCategoryDto(row: CategoryRow): CategoryDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    icon: row.icon,
    image: row.image,
    sortOrder: row.sort_order,
    active: Boolean(row.active),
  };
}
