import { z } from "zod";

export const idParamsSchema = z.object({ id: z.string().uuid() });
export const keyParamsSchema = z.object({ key: z.string().min(1) });

// --- Testimonials ---
const baseTestimonialSchema = z.object({
  name: z.string().min(1).max(150),
  city: z.string().min(1).max(100),
  planId: z.string().max(36).nullable().optional(),
  rating: z.number().int().min(1).max(5),
  quote: z.string().min(1),
  photo: z.string().max(500).nullable().optional(),
  approved: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
export const createTestimonialSchema = baseTestimonialSchema;
export const updateTestimonialSchema = baseTestimonialSchema.partial();

// --- FAQs ---
const baseFaqSchema = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1),
  sortOrder: z.number().int().optional(),
  category: z.string().max(100).nullable().optional(),
  answerConfirmed: z.boolean().optional(),
});
export const createFaqSchema = baseFaqSchema;
export const updateFaqSchema = baseFaqSchema.partial();

// --- Homepage sections ---
// Each item in a homepage_sections.items array is normally a flat record of
// string/number fields (trust-strip icon/title/description, hero image-slot
// url/alt, etc). ONE extension, additive and backward-compatible: a value
// may also be an array of "clip" records -- this is what lets a single
// Video Curation card carry more than one playable video (HOMEPAGE ADMIN
// REBUILD, "Video Showcase must support multiple real videos"). A clip
// record is itself a flat record of string/number/null fields, same shape
// discipline as every other item, just one level deeper -- not open-ended
// z.any(). Every existing item shape (no "clips" key) validates exactly as
// before.
const homepageSectionClipSchema = z.record(z.union([z.string(), z.number(), z.null()]));
const homepageSectionItemSchema = z.record(
  z.union([z.string(), z.number(), z.array(homepageSectionClipSchema)])
);
const baseHomepageSectionSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  heading: z.string().min(1).max(255),
  subheading: z.string().max(500).nullable().optional(),
  body: z.string().nullable().optional(),
  ctaText: z.string().max(100).nullable().optional(),
  ctaLink: z.string().max(255).nullable().optional(),
  items: z.array(homepageSectionItemSchema).nullable().optional(),
  sortOrder: z.number().int().optional(),
  image: z.string().max(500).nullable().optional(),
  imageAlt: z.string().max(255).nullable().optional(),
});
export const createHomepageSectionSchema = baseHomepageSectionSchema;
export const updateHomepageSectionSchema = baseHomepageSectionSchema.omit({ key: true }).partial();

// --- Contact info ---
export const upsertContactInfoSchema = z.object({
  phone: z.string().min(1).max(20).optional(),
  whatsapp: z.string().min(1).max(20).optional(),
  email: z.string().email().max(255).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  hours: z.string().max(255).nullable().optional(),
  socialLinks: z.array(z.object({ platform: z.string().min(1), url: z.string().url() })).optional(),
});

// --- Branding ---
export const upsertBrandingSchema = z.object({
  logoUrl: z.string().max(500).nullable().optional(),
  logoAlt: z.string().max(255).nullable().optional(),
  brandAssets: z.array(z.object({ key: z.string().min(1), url: z.string().min(1), alt: z.string().min(1) })).optional(),
});

// --- Nav items ---
const baseNavItemSchema = z.object({
  label: z.string().min(1).max(100),
  href: z.string().min(1).max(255),
  sortOrder: z.number().int().optional(),
});
export const createNavItemSchema = baseNavItemSchema;
export const updateNavItemSchema = baseNavItemSchema.partial();
