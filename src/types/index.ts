/**
 * Core data types for the Handyman Services frontend.
 *
 * These shapes are the contract between UI components and the Data Access
 * Layer (see src/lib/data/*). They are intentionally backend-agnostic so the
 * layer underneath can later be swapped for WordPress REST/WPGraphQL +
 * WooCommerce, or a custom API + database, without any change here.
 *
 * See: PHASE_2_DATA_ARCHITECTURE.md for the full rationale per entity.
 */

export interface Plan {
  id: string;
  name: string;
  /** Numeric price. Treat as placeholder data until client confirms — see PHASE_2_OPEN_QUESTIONS.md #1. */
  price: number;
  currency: string;
  billingPeriod: string; // e.g. "year"
  description: string;
  visits: number;
  applianceCount: number | "all";
  applianceIds: string[] | "all";
  features: string[];
  badge?: string | null; // e.g. "Most Popular"
  ctaText: string;
  available: boolean;
  sortOrder: number;
  /** True when the underlying figure has not been confirmed by the client (Phase 1/2 conflict). */
  priceConfirmed: boolean;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  icon: string; // icon key, resolved by <CategoryIcon />
  image?: string | null;
  applianceIds: string[];
  sortOrder: number;
}

export interface Appliance {
  id: string;
  name: string;
  categoryId: string;
  icon: string;
  description?: string;
  image?: string | null;
}

export interface Service {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  priceFrom?: number | null;
  image?: string | null;
}

export interface Testimonial {
  id: string;
  name: string;
  city: string;
  planId: string;
  rating: number; // 1-5
  quote: string;
  photo?: string | null;
  approved: boolean;
  sortOrder: number;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  category?: string | null;
  /** True when the answer text is confirmed by the client rather than carried over as a placeholder. */
  answerConfirmed: boolean;
}

export interface ServiceLocation {
  id: string;
  city: string;
  state: string;
  active: boolean;
}

export interface ContactInfo {
  phone: string;
  whatsapp: string;
  email: string | null;
  address: string | null;
  hours: string | null;
  socialLinks: { platform: string; url: string }[];
}

export interface HomepageSectionItem {
  [key: string]: string | number | undefined;
}

export interface HomepageSection {
  key: string;
  heading: string;
  subheading?: string | null;
  body?: string | null;
  ctaText?: string | null;
  ctaLink?: string | null;
  items?: HomepageSectionItem[] | null;
  sortOrder: number;
  /** Optional hero/section image path (e.g. "/images/hero/technician-servicing-ac.jpg"). Falls back to a neutral visual panel when unset. */
  image?: string | null;
  imageAlt?: string | null;
}

export interface NavItem {
  label: string;
  href: string;
}

export interface LeadPayload {
  fullName: string;
  contactNumber: string;
  email: string;
  pincode: string;
  address: string;
  city: string;
  state: string;
  planId: string | null;
  applianceIds: string[];
  consent: boolean;
}

export interface LeadSubmissionResult {
  success: boolean;
  message: string;
}
