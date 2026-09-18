/**
 * Formats a plan price for display (e.g. "₹1,499").
 */
export function formatPrice(price: number, currency: string): string {
  const symbol = currency === "INR" ? "₹" : currency + " ";
  return `${symbol}${price.toLocaleString("en-IN")}`;
}
