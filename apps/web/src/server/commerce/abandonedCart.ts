/**
 * Abandoned Cart Foundation (Milestone C15)
 *
 * Tracks cart abandonment state, timestamps, items, session, and conversation context.
 * Prepares behavioral signals for Customer Intelligence phase without spamming the shopper.
 */

import prisma from "@/lib/prisma";

export class AbandonedCartTracker {
  static async recordAbandonment(input: {
    orgId: string;
    cartId: string;
    sessionId: string;
    customerId?: string;
    conversationId?: string;
  }): Promise<void> {
    const cart = await prisma.cart.findFirst({
      where: { id: input.cartId, orgId: input.orgId },
      include: { items: true },
    });

    if (!cart || cart.items.length === 0) return;

    await prisma.cart.update({
      where: { id: input.cartId },
      data: { status: "ABANDONED" },
    });

    await prisma.abandonedCart.upsert({
      where: { cartId: input.cartId },
      create: {
        orgId: input.orgId,
        cartId: input.cartId,
        sessionId: input.sessionId,
        customerId: input.customerId || null,
        conversationId: input.conversationId || null,
        cartValue: cart.totalAmount,
        itemCount: cart.items.reduce((acc, i) => acc + i.quantity, 0),
        lastActivityAt: new Date(),
        status: "ABANDONED",
      },
      update: {
        cartValue: cart.totalAmount,
        itemCount: cart.items.reduce((acc, i) => acc + i.quantity, 0),
        lastActivityAt: new Date(),
        status: "ABANDONED",
      },
    });
  }
}
