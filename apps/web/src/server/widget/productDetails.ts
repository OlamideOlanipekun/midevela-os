import prisma from "@/lib/prisma";
import { formatMoney } from "@/server/catalog/money";

export interface ProductDetailsInput {
  productId: string;
  orgId: string;
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
    replyText: formatDetailsReply(dbProduct, price, attributes),
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
): string {
  const parts: string[] = [];

  // Summary: name + price
  parts.push(`**${product.name}** — ${price}`);

  // Description
  if (product.description) {
    parts.push(product.description);
  } else if (product.aiDescription) {
    parts.push(product.aiDescription);
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

  // Key attributes
  const attrLines: string[] = [];
  for (const [key, value] of Object.entries(attributes)) {
    if (value && value !== "—" && value !== "") {
      const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
      attrLines.push(`${label}: ${value}`);
    }
  }
  if (attrLines.length > 0) {
    parts.push(attrLines.join("\n"));
  }

  return parts.join("\n\n");
}
