import { apiRequest, AuthApiError } from "@/lib/auth/api";

/**
 * Admin Homepage Content API client (AUDIT FOLLOW-UP — "Admin CMS/
 * content-management pipeline"). Thin wrapper around the backend's
 * already-existing, already-admin-gated `content` module
 * (backend/src/modules/content/content.routes.ts, homepageSections.*) —
 * the same `GET /homepage-sections` (public) / `PATCH
 * /admin/homepage-sections/:key` (admin) endpoints the live customer
 * homepage now reads from (see `@/lib/data/homepageSectionsLive.ts`).
 *
 * `items` is deliberately generic (`Record<string, string | number>[]`) —
 * the backend column is a flexible JSON array, reused here for three
 * different homepage collections (trust-strip items, video-curation
 * cards, and the hero's secondary-CTA pair) rather than three new tables.
 */
export { AuthApiError };

export interface HomepageSectionItemClip {
  [key: string]: string | number | null | undefined;
}

export interface HomepageSectionItem {
  [key: string]: string | number | HomepageSectionItemClip[] | undefined;
}

export interface AdminHomepageSection {
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

export interface HomepageSectionInput {
  key: string;
  heading: string;
  subheading?: string | null;
  body?: string | null;
  ctaText?: string | null;
  ctaLink?: string | null;
  items?: HomepageSectionItem[] | null;
  sortOrder?: number;
  image?: string | null;
  imageAlt?: string | null;
}

export function listHomepageSectionsAdmin(): Promise<AdminHomepageSection[]> {
  return apiRequest<AdminHomepageSection[]>("/homepage-sections", { method: "GET" });
}

export function createHomepageSection(input: HomepageSectionInput): Promise<AdminHomepageSection> {
  return apiRequest<AdminHomepageSection>("/admin/homepage-sections", { method: "POST", body: JSON.stringify(input) });
}

export function updateHomepageSection(
  key: string,
  input: Partial<Omit<HomepageSectionInput, "key">>
): Promise<AdminHomepageSection> {
  return apiRequest<AdminHomepageSection>(`/admin/homepage-sections/${key}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteHomepageSection(key: string): Promise<{ success: boolean }> {
  return apiRequest(`/admin/homepage-sections/${key}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------
// Branding + Contact Info (HOMEPAGE ADMIN REBUILD — "Header and
// branding"). Thin wrappers around the backend's existing, already-built
// `branding`/`contact_info` singleton endpoints (content.routes.ts) —
// same admin-gated PATCH, public GET pattern as every other module here.
// ---------------------------------------------------------------------

export interface BrandAsset {
  key: string;
  url: string;
  alt: string;
}

export interface AdminBranding {
  logoUrl: string | null;
  logoAlt: string | null;
  brandAssets: BrandAsset[];
}

export interface BrandingInput {
  logoUrl?: string | null;
  logoAlt?: string | null;
  brandAssets?: BrandAsset[];
}

export function getBrandingAdmin(): Promise<AdminBranding> {
  return apiRequest<AdminBranding>("/branding", { method: "GET" });
}

export function updateBranding(input: BrandingInput): Promise<AdminBranding> {
  return apiRequest<AdminBranding>("/admin/branding", { method: "PATCH", body: JSON.stringify(input) });
}

export interface SocialLink {
  platform: string;
  url: string;
}

export interface AdminContactInfo {
  phone: string;
  whatsapp: string;
  email: string | null;
  address: string | null;
  hours: string | null;
  socialLinks: SocialLink[];
}

export interface ContactInfoInput {
  phone?: string;
  whatsapp?: string;
  email?: string | null;
  address?: string | null;
  hours?: string | null;
  socialLinks?: SocialLink[];
}

export function getContactInfoAdmin(): Promise<AdminContactInfo | null> {
  return apiRequest<AdminContactInfo | null>("/contact-info", { method: "GET" });
}

export function updateContactInfo(input: ContactInfoInput): Promise<AdminContactInfo> {
  return apiRequest<AdminContactInfo>("/admin/contact-info", { method: "PATCH", body: JSON.stringify(input) });
}

