/**
 * Original, generic placeholder illustrations for DEMO products that have no
 * uploaded image yet (kept in /public/shop-demo). They are neutral line
 * drawings — not photos of any brand's product — and only ever stand in for
 * demo listings; a real product shows its own Media Library images.
 */
export function demoImageFor(categorySlug: string, name: string): string | null {
  const key = `${categorySlug} ${name}`.toLowerCase();
  if (key.includes("washing")) return "/shop-demo/washing-machine.svg";
  if (key.includes("refrigerator") || key.includes("fridge")) return "/shop-demo/refrigerator.svg";
  if (key.includes("purifier")) return "/shop-demo/water-purifier.svg";
  return null;
}
