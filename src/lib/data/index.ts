/**
 * Data Access Layer barrel export.
 *
 * Every business-data read in the app should go through one of these
 * functions rather than importing JSON directly from components. This is
 * the single seam described in PHASE_2_SYSTEM_DESIGN.md §3 — swapping the
 * data source later means editing the files in this folder only.
 */
export * from "./plans";
export * from "./categories";
export * from "./appliances";
export * from "./testimonials";
export * from "./faqs";
export * from "./contact";
export * from "./homepageSections";
export * from "./nav";
export * from "./leads";
