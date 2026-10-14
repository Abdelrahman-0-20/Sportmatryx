/**
 * Demo pricing for marketplace data packages.
 *
 * HONESTY RULE (spec §25): these are DISPLAY-ONLY demo prices so the cart
 * arithmetic is visible. No payment processing happens anywhere — checkout is
 * a labeled demo and no money moves.
 *
 * Prices are deterministic per product id so server renders, client renders
 * and re-priced checkouts always agree.
 */

/** Deterministic demo price in cents for a product id ($19.00–$59.00, $5 steps). */
export function demoPriceCents(productId: string): number {
  let h = 0;
  for (let i = 0; i < productId.length; i++) {
    h = (h * 31 + productId.charCodeAt(i)) >>> 0;
  }
  const step = h % 9; // 0..8 → 9 price points
  return 1900 + step * 500;
}

/** Format cents as USD, e.g. 3900 → "$39.00". */
export function formatUsdCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rem = String(abs % 100).padStart(2, "0");
  return `${sign}$${dollars}.${rem}`;
}