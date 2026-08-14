/**
 * Checkout Failure Recovery (Milestone C13)
 *
 * Handles live commerce failures (out of stock, variant sold out, price change,
 * expired cart, timeout) and provides graceful recovery and alternative options.
 */

import prisma from "@/lib/prisma";

export interface FailureRecoveryResult {
  hasRecovery: boolean;
  message: string;
  suggestedAlternatives?: Array<{
    id: string;
    name: string;
    price: number;
    currency: string;
  }>;
}

export class CheckoutRecoveryEngine {
  static async handleFailure(
    orgId: string,
    productId: string,
    variantId?: string,
    reason?: string
  ): Promise<FailureRecoveryResult> {
    // Find alternative in-stock products in the same category or organization
    const product = await prisma.product.findFirst({
      where: { id: productId, orgId },
      select: { categoryId: true, name: true },
    });

    const alternatives = await prisma.product.findMany({
      where: {
        orgId,
        inventoryStatus: "IN_STOCK",
        id: { not: productId },
        ...(product?.categoryId ? { categoryId: product.categoryId } : {}),
      },
      take: 2,
    });

    const mappedAlts = alternatives.map((a) => ({
      id: a.id,
      name: a.name,
      price: Number(a.price),
      currency: a.currency,
    }));

    if (mappedAlts.length > 0) {
      return {
        hasRecovery: true,
        message: `That option just became unavailable. However, I found ${mappedAlts.length} similar available item(s) for you!`,
        suggestedAlternatives: mappedAlts,
      };
    }

    return {
      hasRecovery: false,
      message: `Sorry, that item is currently unavailable (${reason || "out of stock"}).`,
    };
  }
}
