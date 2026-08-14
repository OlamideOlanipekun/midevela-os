import { describe, it, expect, beforeEach, vi } from "vitest";
import { AttributionEngine } from "../attributionEngine";

vi.mock("@/lib/prisma", () => ({
  default: {
    cart: {
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    conversation: {
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    attributedOrder: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";

describe("Conversion Attribution Engine (Milestone C9, C10, C12)", () => {
  const orgId = "00000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("attributes DIRECT conversion when cartId or conversationId is provided", async () => {
    (prisma.cart.findFirst as any).mockResolvedValue({
      id: "cart_123",
      orgId,
    });

    (prisma.attributedOrder.create as any).mockResolvedValue({
      id: "attr_order_1",
      orgId,
      orderId: "ord_101",
      attributionType: "DIRECT",
    });

    const result = await AttributionEngine.recordPurchase({
      orgId,
      orderId: "ord_101",
      amount: 85000,
      cartId: "cart_123",
      conversationId: "conv_456",
    });

    expect(result.attributionType).toBe("DIRECT");
    expect(result.attributedOrderId).toBe("attr_order_1");
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: "conv_456" },
      data: { outcome: "PURCHASED" },
    });
  });

  it("attributes ASSISTED conversion when recent conversation exists in session", async () => {
    (prisma.conversation.findFirst as any).mockResolvedValue({
      id: "conv_789",
      orgId,
    });

    (prisma.attributedOrder.create as any).mockResolvedValue({
      id: "attr_order_2",
      orgId,
      orderId: "ord_102",
      attributionType: "ASSISTED",
    });

    const result = await AttributionEngine.recordPurchase({
      orgId,
      orderId: "ord_102",
      amount: 45000,
      sessionId: "sess_xyz",
    });

    expect(result.attributionType).toBe("ASSISTED");
    expect(result.attributedOrderId).toBe("attr_order_2");
  });

  it("calculates accurate revenue and conversion metrics for merchant dashboard", async () => {
    (prisma.attributedOrder.findMany as any).mockResolvedValue([
      { amount: 85000, attributionType: "DIRECT", currency: "NGN" },
      { amount: 45000, attributionType: "ASSISTED", currency: "NGN" },
    ]);

    (prisma.conversation.count as any).mockResolvedValue(100);
    (prisma.cart.count as any).mockResolvedValue(20);

    const metrics = await AttributionEngine.getRevenueMetrics(orgId);

    expect(metrics.revenueInfluenced).toBe(130000);
    expect(metrics.ordersInfluenced).toBe(2);
    expect(metrics.directOrders).toBe(1);
    expect(metrics.assistedOrders).toBe(1);
    expect(metrics.averageOrderValue).toBe(65000);
    expect(metrics.conversionRate).toBe(2.0); // 2 orders out of 100 chats
    expect(metrics.addToCartRate).toBe(20.0); // 20 carts out of 100 chats
  });
});
