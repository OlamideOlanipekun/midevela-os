import { listCategoriesForWidget } from "@/server/catalog/categories";

export interface BrowseResult {
  replyText: string;
  categories: Array<{ id: string; name: string; productCount: number }>;
  hasProducts: boolean;
}

/**
 * Handle "show categories", "browse", "what do you have" requests.
 * Lists all available categories that have products.
 */
export async function handleBrowse(orgId: string): Promise<BrowseResult> {
  const categories = await listCategoriesForWidget(orgId);

  if (categories.length === 0) {
    return {
      replyText: "I don't have any categories available right now. Is there something specific you're looking for?",
      categories: [],
      hasProducts: false,
    };
  }

  const lines = categories.map(
    (c) => `• **${c.name}**${c.productCount > 0 ? ` (${c.productCount} products)` : ""}`,
  );

  return {
    replyText: [
      `Here's what we have:`,
      ``,
      ...lines,
      ``,
      `Which category interests you?`,
    ].join("\n"),
    categories: categories.map((c) => ({ id: c.id, name: c.name, productCount: c.productCount })),
    hasProducts: categories.some((c) => c.productCount > 0),
  };
}
