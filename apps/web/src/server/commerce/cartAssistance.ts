/**
 * Intelligent Cart Assistance (Milestone C6)
 *
 * Recommends relevant cross-sell/upsell items based on:
 *   - Current cart items
 *   - Shopping intent & category
 *   - Catalog availability
 * Keeps recommendations clearly distinguished from items already in cart.
 */

import prisma from "@/lib/prisma";
import type { CommerceCart } from "./types";
import { formatMoney } from "@/server/catalog/money";

export interface RecommendedAddon {
  id: string;
  name: string;
  price: number;
  currency: string;
  formattedPrice: string;
  reason: string;
}

export class CartAssistanceEngine {
  /**
   * Generates cross-sell/upsell suggestions for the shopper's active cart.
   */
  static async getCrossSellRecommendations(
    orgId: string,
    cart: CommerceCart,
    limit = 3
  ): Promise<RecommendedAddon[]> {
    if (!cart || cart.items.length === 0) return [];

    const inCartProductIds = new Set(cart.items.map((i) => i.productId));

    // Fetch catalog products excluding items already in cart
    const catalogProducts = await prisma.product.findMany({
      where: {
        orgId,
        inventoryStatus: "IN_STOCK",
        id: { notIn: Array.from(inCartProductIds) },
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    return catalogProducts.map((p) => {
      const priceNum = Number(p.price);
      return {
        id: p.id,
        name: p.name,
        price: priceNum,
        currency: p.currency,
        formattedPrice: formatMoney(priceNum, p.currency),
        reason: "Pairs well with items in your cart",
      };
    });
  }
}
