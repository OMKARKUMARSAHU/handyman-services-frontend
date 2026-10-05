export interface ProductDto {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  image: string | null;
  categoryId: string;
  sortOrder: number;
  active: boolean;
}

export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  image: string | null;
  category_id: string;
  sort_order: number;
  active: number | boolean;
}

export function toProductDto(row: ProductRow): ProductDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    icon: row.icon,
    image: row.image,
    categoryId: row.category_id,
    sortOrder: row.sort_order,
    active: Boolean(row.active),
  };
}
