/** Dependency-free so both products.ts and categories.ts can import it
 *  without creating a circular import between the two. */
export function iconFor(categoryName: string): string {
  const c = categoryName.toLowerCase();
  if (c.includes("fashion") || c.includes("apparel")) return "🛍️";
  if (c.includes("beauty") || c.includes("cosmetic")) return "🧴";
  if (c.includes("electronic")) return "💻";
  return "📦";
}
