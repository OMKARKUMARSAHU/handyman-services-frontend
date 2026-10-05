export const BRANDING_SINGLETON_ID = "singleton";

export interface BrandAsset {
  key: string;
  url: string;
  alt: string;
}

export interface BrandingRow {
  id: string;
  logo_url: string | null;
  logo_alt: string | null;
  brand_assets: string | null; // JSON column
}

export interface BrandingDto {
  logoUrl: string | null;
  logoAlt: string | null;
  brandAssets: BrandAsset[];
}

function parseAssets(value: string | null): BrandAsset[] {
  if (value === null) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function toBrandingDto(row: BrandingRow): BrandingDto {
  return { logoUrl: row.logo_url, logoAlt: row.logo_alt, brandAssets: parseAssets(row.brand_assets) };
}
