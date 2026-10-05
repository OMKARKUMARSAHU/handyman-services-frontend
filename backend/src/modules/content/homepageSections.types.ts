export interface HomepageSectionItem {
  [key: string]: string | number | undefined;
}

export interface HomepageSectionRow {
  key: string;
  heading: string;
  subheading: string | null;
  body: string | null;
  cta_text: string | null;
  cta_link: string | null;
  items: string | null; // JSON column — string with mysql2 unless typeCast configured
  sort_order: number;
  image: string | null;
  image_alt: string | null;
}

export interface HomepageSectionDto {
  key: string;
  heading: string;
  subheading: string | null;
  body: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  items: HomepageSectionItem[] | null;
  sortOrder: number;
  image: string | null;
  imageAlt: string | null;
}

function parseItems(value: string | null): HomepageSectionItem[] | null {
  if (value === null) return null;
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function toHomepageSectionDto(row: HomepageSectionRow): HomepageSectionDto {
  return {
    key: row.key,
    heading: row.heading,
    subheading: row.subheading,
    body: row.body,
    ctaText: row.cta_text,
    ctaLink: row.cta_link,
    items: parseItems(row.items),
    sortOrder: row.sort_order,
    image: row.image,
    imageAlt: row.image_alt,
  };
}
