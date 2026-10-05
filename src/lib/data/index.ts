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

// Marketplace entities (PHASE_2_API_CONTRACT.md). appliances.ts/categories.ts
// above stay as-is and keep backing the legacy /services/[category] route;
// these are the new City → Category → Product → ServiceType → Service reads.
export * from "./cities";
export * from "./products";
export * from "./serviceTypes";
export * from "./services";
export * from "./offers";
export * from "./search";
// RAZORPAY INTEGRATION: the Phase-3 mock order store (./orders.ts, localStorage-only, never talked to the backend) has been removed -- checkout now uses the real backend via @/lib/customer/api (createMyOrder/getMyOrder).
export * from "./videoCurations";
