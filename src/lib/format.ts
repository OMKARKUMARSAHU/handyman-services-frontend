/**
 * Formats a plan price for display (e.g. "₹1,499").
 */
export function formatPrice(price: number, currency: string): string {
  const symbol = currency === "INR" ? "₹" : currency + " ";
  return `${symbol}${price.toLocaleString("en-IN")}`;
}

/** Convenience wrapper for the marketplace's INR-only mock pricing (Service.mrp/offerPrice, Cart/Order totals). */
export function formatINR(amount: number): string {
  return formatPrice(amount, "INR");
}

/** Formats whole seconds as "m:ss" for a video-duration badge (e.g. 125 -> "2:05"). */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
