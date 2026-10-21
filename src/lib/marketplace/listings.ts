/**
 * Marketplace listings — shared constants for the seller listings feature.
 * Server routes and client components both import from here so the status
 * values stay in sync.
 */

/** Status value for listings visible in the marketplace. */
export const PUBLISHED_STATUS = "PUBLISHED";

/** Status value for listings removed by their seller (kept for audit history). */
export const REMOVED_STATUS = "REMOVED";

/** Maximum listings returned by the public list endpoint. */
export const MAX_PUBLIC_LISTINGS = 60;