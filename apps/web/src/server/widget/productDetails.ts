import prisma from "@/lib/prisma";
import { formatMoney } from "@/server/catalog/money";

export interface ProductDetailsInput {
  productId: string;
  orgId: string;
  /** Names of other recommended products to suggest comparisons */
  otherProductNames?: string[];
}

export interface ProductDetailsResult {
  replyText: string;
  product: {
    id: string;
    name: string;
    brand: string | null;
    price: string;
    description: string | null;
    aiDescription: string | null;
    attributes: Record<string, unknown>;
    inStock: boolean;
    imageUrl: string | null;
    url: string | null;
  };
}

export async function getProductDetails(
  input: ProductDetailsInput,
): Promise<ProductDetailsResult | null> {
  const dbProduct = await prisma.product.findFirst({
    where: { id: input.productId, orgId: input.orgId },
  });

  if (!dbProduct) return null;

  const price = formatMoney(dbProduct.price, dbProduct.currency);
  const imageUrl = Array.isArray(dbProduct.images) && dbProduct.images.length > 0
    ? String(dbProduct.images[0])
    : null;

  const attributes =
    dbProduct.attributes && typeof dbProduct.attributes === "object"
      ? (dbProduct.attributes as Record<string, unknown>)
      : {};

  return {
    replyText: formatDetailsReply(
      {
        name: dbProduct.name,
        brand: dbProduct.brand,
        description: dbProduct.description,
        aiDescription: dbProduct.aiDescription,
        inventoryStatus: dbProduct.inventoryStatus,
      },
      price,
      attributes,
      input.otherProductNames,
    ),
    product: {
      id: dbProduct.id,
      name: dbProduct.name,
      brand: dbProduct.brand,
      price,
      description: dbProduct.description,
      aiDescription: dbProduct.aiDescription,
      attributes,
      inStock: dbProduct.inventoryStatus !== "OUT_OF_STOCK",
      imageUrl,
      url: dbProduct.sourceUrl,
    },
  };
}

function formatDetailsReply(
  product: {
    name: string;
    brand: string | null;
    description: string | null;
    aiDescription: string | null;
    inventoryStatus: string;
  },
  price: string,
  attributes: Record<string, unknown>,
  otherProductNames?: string[],
): string {
  const parts: string[] = [];

  // Name + price
  parts.push(`**${product.name}** — ${price}`);

  // Short benefit summary (first sentence of description or the aiDescription)
  const fullDesc = product.description || product.aiDescription;
  const snippet = fullDesc ? fullDesc.split(".")[0].trim() + "." : null;
  if (snippet && snippet.length > 10) {
    parts.push(snippet);
  }

  // Brand
  if (product.brand) {
    parts.push(`Brand: ${product.brand}`);
  }

  // Availability
  parts.push(
    product.inventoryStatus !== "OUT_OF_STOCK"
      ? "Currently in stock."
      : "Currently out of stock.",
  );

  // Key attributes (filter to the most informative 4-5)
  const attrLines: string[] = [];
  const skipKeys = new Set(["ingredients", "howToUse", "warnings"]);
  let count = 0;
  for (const [key, value] of Object.entries(attributes)) {
    if (value && value !== "—" && value !== "" && !skipKeys.has(key) && count < 5) {
      const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
      attrLines.push(`${label}: ${value}`);
      count++;
    }
  }
  if (attrLines.length > 0) {
    parts.push(attrLines.join("\n"));
  }

  // Full description when it adds detail beyond the snippet
  if (fullDesc && fullDesc.length > (snippet?.length ?? 0)) {
    parts.push(fullDesc);
  }

  // Closing action prompts
  const prompts: string[] = [];
  if (otherProductNames && otherProductNames.length > 0) {
    const compareNames = otherProductNames.slice(0, 2);
    if (compareNames.length === 1) {
      prompts.push(`Would you like to compare it with **${compareNames[0]}**?`);
    } else if (compareNames.length === 2) {
      prompts.push(`Would you like to compare it with **${compareNames[0]}** or **${compareNames[1]}**?`);
    }
  }
  prompts.push("Would you like to see another product?");

  parts.push(prompts.join("\n"));

  return parts.join("\n\n");
}
