import { getDb } from "../../database/db";
import { BRANDING_SINGLETON_ID, toBrandingDto, type BrandAsset, type BrandingDto, type BrandingRow } from "./branding.types";

const TABLE = "branding";

const EMPTY_BRANDING: BrandingDto = { logoUrl: null, logoAlt: null, brandAssets: [] };

export async function getBranding(): Promise<BrandingDto> {
  const row = await getDb()<BrandingRow>(TABLE).where({ id: BRANDING_SINGLETON_ID }).first();
  return row ? toBrandingDto(row) : EMPTY_BRANDING;
}

export interface UpsertBrandingInput {
  logoUrl?: string | null;
  logoAlt?: string | null;
  brandAssets?: BrandAsset[];
}

/** One row for the whole site (id = "singleton") — logo/brand-asset REFERENCES only (S3 URLs from the media upload flow), never uploaded bytes. */
export async function upsertBranding(input: Partial<UpsertBrandingInput>): Promise<BrandingDto> {
  const existing = await getDb()<BrandingRow>(TABLE).where({ id: BRANDING_SINGLETON_ID }).first();

  if (!existing) {
    await getDb()<BrandingRow>(TABLE).insert({
      id: BRANDING_SINGLETON_ID,
      logo_url: input.logoUrl ?? null,
      logo_alt: input.logoAlt ?? null,
      brand_assets: JSON.stringify(input.brandAssets ?? []),
    } as unknown as BrandingRow);
  } else {
    const patch: Partial<BrandingRow> = {};
    if (input.logoUrl !== undefined) patch.logo_url = input.logoUrl;
    if (input.logoAlt !== undefined) patch.logo_alt = input.logoAlt;
    if (input.brandAssets !== undefined) patch.brand_assets = JSON.stringify(input.brandAssets) as unknown as string;
    if (Object.keys(patch).length > 0) {
      await getDb()<BrandingRow>(TABLE).where({ id: BRANDING_SINGLETON_ID }).update(patch);
    }
  }

  const row = await getDb()<BrandingRow>(TABLE).where({ id: BRANDING_SINGLETON_ID }).first();
  return toBrandingDto(row!);
}
