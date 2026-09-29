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

/* -------------------------------------------------------------------------
 * Marketplace entities (PHASE_2_DATA_ARCHITECTURE.md).
 *
 * These are the new, central data shapes for the Location → Category →
 * Product → Service Type → Service marketplace approved in Phase 1/2. Mock
 * content lives in src/data/*.json; every read goes through src/lib/data/*
 * (see PHASE_2_API_CONTRACT.md). No city list, catalogue, or business rule
 * below should be read as final — see PHASE_2_OPEN_QUESTIONS.md.
 * ---------------------------------------------------------------------- */

export interface City {
  id: string;
  name: string;
  state: string;
  slug: string;
  isPopular: boolean;
  active: boolean;
  sortOrder: number;
  /**
   * Location-selector landmark visual (LOCATION SELECTOR — LANDMARK ICON
   * SYSTEM phase). Admin-Panel-ready: a future Admin Panel sets this to an
   * uploaded asset's URL; the frontend never hardcodes a per-city image
   * import. `null`/undefined means "no icon uploaded yet" — components must
   * render the shared neutral fallback illustration in that case, never a
   * broken image or empty box. Optional so existing mock rows and any
   * future city added without an icon stay valid.
   */
  iconUrl?: string | null;
  /**
   * Accessible text for the icon. When the icon is purely decorative next
   * to an already-visible city name, components pass `alt=""`; this field
   * exists for when the icon is the only conveyed information (e.g. inside
   * an icon-only control) or for a future Admin-authored description.
   */
  iconAlt?: string | null;
}

/** Renamed conceptually from `Appliance` — see PHASE_2_DATA_ARCHITECTURE.md §3 (Product). */
export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  image?: string | null;
  categoryId: string;
  sortOrder: number;
  active: boolean;
}

export interface ServiceType {
  id: string;
  key: string;
  label: string;
  sortOrder: number;
  active: boolean;
}

export interface ServiceImage {
  id: string;
  serviceId: string;
  url: string;
  alt: string;
  sortOrder: number;
}

/**
 * The central, bookable, priced catalog entity. Replaces the old unused
 * `Service` shape (categoryId/priceFrom) — that type was never referenced
 * elsewhere in the codebase, so it is redefined here rather than kept
 * alongside a second, conflicting `Service` type.
 */
export interface Service {
  id: string;
  slug: string;
  productId: string;
  serviceTypeId: string;
  name: string;
  shortDescription: string;
  description: string;
  whatsIncluded: string[];
  images: ServiceImage[];
  /** Demo/mock pricing, not client-confirmed final pricing — see `lib/data/services.ts`'s doc comment. */
  mrp: number;
  /** Demo/mock pricing, not client-confirmed final pricing — see `lib/data/services.ts`'s doc comment. */
  offerPrice: number;
  /** Derived at read time from mrp/offerPrice only — see lib/pricing.ts. Never mutate directly. */
  discountPercent: number;
  /** Derived at read time from mrp/offerPrice only — see lib/pricing.ts. Never mutate directly. */
  discountAmount: number;
  /**
   * Admin-set DISPLAY VALUES ONLY (client-approved, homepage redesign
   * decision #2) — there is no customer review-submission, moderation, or
   * review-text system in Phase 3. `null` means "no rating set", rendered
   * as no rating badge, never a fabricated 0/5.
   */
  ratingAverage: number | null;
  ratingCount: number;
  /**
   * Admin-curated flag (client-approved, homepage redesign decision #1)
   * driving the "Most Booked Services" homepage rail. Deliberately NOT
   * computed from real order/booking volume — no such data exists in
   * Phase 3 (mock JSON, no real bookings) — see PHASE_2_OPEN_QUESTIONS.md #18.
   */
  isMostBooked: boolean;
  /** Convenience accessor derived from ServiceCityAvailability — not stored redundantly. */
  availableCityIds: string[];
  featured: boolean;
  active: boolean;
  sortOrder: number;
}

export interface ServiceCityAvailability {
  id: string;
  serviceId: string;
  cityId: string;
  active: boolean;
}

export interface Offer {
  id: string;
  title: string;
  description: string;
  discountType: "percent" | "flat";
  discountValue: number;
  appliesTo: { scope: "all" | "category" | "service"; ids: string[] };
  bannerImage: string | null;
  startDate: string | null;
  endDate: string | null;
  active: boolean;
}

/** [TBD — depends entirely on the login-method decision, Phase 1 §19]. */
export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  addressIds: string[];
}

export interface Address {
  id: string;
  /** nullable — a guest checkout may create an address without a saved customer, [TBD]. */
  customerId: string | null;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export interface CartItem {
  id: string;
  serviceId: string;
  quantity: number;
  /** Snapshotted at add-time so a later price change doesn't silently alter an existing cart. */
  unitPriceAtAdd: number;
  /**
   * The city the service was added under (from the URL at add-to-cart time).
   * Structural only — what checkout should do when a cart spans more than
   * one city is [TBD], see PHASE_2_DATA_ARCHITECTURE.md §3 and
   * PHASE_2_OPEN_QUESTIONS.md #24. No restriction is enforced here.
   */
  cityId: string;
}

export interface Cart {
  id: string;
  customerId: string | null;
  sessionId: string;
  items: CartItem[];
}

export interface OrderItem {
  id: string;
  serviceId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface Order {
  id: string;
  /** nullable/optional — reconciled with guest-checkout TBD, see PHASE_2_OPEN_QUESTIONS.md #17. */
  customerId: string | null;
  items: OrderItem[];
  /** Snapshot, not a live FK — a later address edit shouldn't rewrite history. */
  address: Address;
  scheduledDate: string;
  /** [TBD — slot rules unconfirmed]. */
  scheduledSlot: string | null;
  subtotal: number;
  discountTotal: number;
  total: number;
  status: OrderStatus;
  /** [TBD]. */
  providerId: string | null;
  /** [TBD — depends on the payment-gateway decision]. Never a real payment state in Phase 3. */
  paymentStatus: string;
  createdAt: string;
}

/** [TBD — dashboard scope and auth method both open]. */
export interface ServiceProvider {
  id: string;
  name: string;
  phone: string;
  assignedOrderIds: string[];
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

/**
 * "FINAL HOMEPAGE / UX CORRECTION" item 4 — the generic content shape the
 * large promotional-banner component (`LargeSpotlightBanner.tsx`) renders
 * from: `id, eyebrow, title, subtitle, ctaText, ctaLink, image, imageAlt,
 * background, badge`, exactly the field list the client specified so a
 * future Admin Panel can populate real banners without a component
 * redesign. This mock-data phase has no dedicated "promotional banner"
 * table — the component maps each active `Offer` into this shape at
 * render time (see that file's doc comment for why: reusing the single
 * `Offer` source of truth rather than a second, parallel banner data file
 * that could drift out of sync with the real discount it's promoting) —
 * but the component itself only ever reads this type, never `Offer`
 * directly, so swapping in a real banner data source later is a mapping
 * change, not a redesign.
 */
export interface PromotionalBannerContent {
  id: string;
  eyebrow?: string | null;
  title: string;
  subtitle?: string | null;
  ctaText: string;
  ctaLink: string;
  /** Decorative background image path — always original, in-house artwork. */
  image: string;
  imageAlt?: string | null;
  /** Optional CSS gradient/overlay hint; falls back to a sensible default when unset. */
  background?: string | null;
  badge?: string | null;
}

/**
 * Phase 3 revision — "Video Curations" homepage section. Admin-curated
 * short-form video entries (technician visits, installs, service
 * walkthroughs), independent of the Service catalog so a curation can
 * showcase a general topic ("What a technician visit looks like") without
 * being tied to one bookable Service. `categoryId`/`serviceTypeId` are
 * optional tags only, used for a small label on the card — never a filter
 * or route, consistent with how `serviceTypeId` is already treated as
 * non-routable in the footer's "Popular Services" column.
 *
 * `thumbnail`/`videoUrl` are nullable by design: this mock-data phase has
 * no real footage or photography, and `null` renders an honest neutral
 * placeholder card (see VideoCurationCard.tsx) rather than a fabricated
 * image or a broken embed. Swapping in real assets later is a data-file
 * edit only, same pattern as every other media field in this project.
 */
export interface VideoCuration {
  id: string;
  title: string;
  description?: string | null;
  /** Tag only — not a filter/route. See doc comment above. */
  categoryId?: string | null;
  /** Tag only — not a filter/route. See doc comment above. */
  serviceTypeId?: string | null;
  /** Poster/thumbnail image path, e.g. "/videos/curations/ac-install.jpg". `null` = no image yet. */
  thumbnail: string | null;
  /** Locally hosted video file path. `null` in this phase — no real footage exists yet. */
  videoUrl: string | null;
  /** External video link (e.g. YouTube/Vimeo) as an alternative to a locally hosted file. */
  externalUrl?: string | null;
  /** Whole seconds, for an optional duration badge. `null`/unset hides the badge. */
  durationSeconds?: number | null;
  sortOrder: number;
  active: boolean;
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
