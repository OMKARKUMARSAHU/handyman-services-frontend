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

export interface HomepageSectionItem {
  [key: string]: string | number | undefined;
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
