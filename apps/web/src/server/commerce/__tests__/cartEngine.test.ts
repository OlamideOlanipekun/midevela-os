import { describe, it, expect, beforeEach, vi } from "vitest";
import { CommerceSafetyLayer } from "../safetyLayer";
import { IdempotencyManager } from "../idempotency";
import { CartEngine } from "../cartEngine";
import { CartAssistanceEngine } from "../cartAssistance";
import { CheckoutHandoffEngine } from "../checkoutHandoff";
import { CheckoutRecoveryEngine } from "../checkoutRecovery";
import { AbandonedCartTracker } from "../abandonedCart";
import { CheckoutAssistanceEngine } from "../checkoutAssistance";

vi.mock("@/lib/prisma", () => ({
  default: {
    product: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    productVariant: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
    cart: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    cartItem: {
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    abandonedCart: {
      upsert: vi.fn(),
    },
    knowledgeEntry: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/server/widget/checkoutHandler", () => ({
  generatePaymentLink: vi.fn().mockResolvedValue({
    paymentUrl: "https://checkout.paystack.com/test_ref",
    isPaystack: true,
    productName: "Sneakers",
    productPrice: "₦90,000",
  }),
}));

import prisma from "@/lib/prisma";

describe("Cart Engine & Commerce System (Milestone C3, C4, C5, C6, C7, C8, C13, C14, C15, C16, C17, C18)", () => {
  const orgId = "00000000-0000-0000-0000-000000000001";
  const sessionId = "sess_test_123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("C17 — Commerce Safety Layer", () => {
    it("authorizes valid add to cart proposals", () => {
      const auth = CommerceSafetyLayer.authorizeAction({
        actionType: "ADD_TO_CART",
        orgId,
        sessionId,
        productId: "p1",
        quantity: 2,
      });
      expect(auth.authorized).toBe(true);
      expect(auth.sanitizedQuantity).toBe(2);
    });

    it("rejects unauthorized proposals with missing orgId or invalid quantities", () => {
      const auth1 = CommerceSafetyLayer.authorizeAction({
        actionType: "ADD_TO_CART",
        orgId: "",
        sessionId,
        productId: "p1",
        quantity: 2,
      });
      expect(auth1.authorized).toBe(false);

      const auth2 = CommerceSafetyLayer.authorizeAction({
        actionType: "ADD_TO_CART",
        orgId,
        sessionId,
        productId: "p1",
        quantity: 500, // exceeds max per item (50)
      });
      expect(auth2.authorized).toBe(false);
      expect(auth2.reason).toContain("exceeds max allowed");
    });
  });

  describe("C18 — Idempotency Manager", () => {
    it("generates deterministic keys and prevents duplicate execution on retry", async () => {
      const key = IdempotencyManager.generateKey(sessionId, "ADD_TO_CART", { productId: "p1", quantity: 1 });
      expect(key).toBeDefined();

      let runCount = 0;
      const task = async () => {
        runCount++;
        return { success: true, count: runCount };
      };

      const res1 = await IdempotencyManager.executeIdempotent(key, task);
      const res2 = await IdempotencyManager.executeIdempotent(key, task);

      expect(res1.count).toBe(1);
      expect(res2.count).toBe(1); // returned cached result, didn't re-run
      expect(runCount).toBe(1);
    });
  });

  describe("C3, C14 — Cart Engine Live Operations & Validation", () => {
    it("adds item to cart only after availability confirmation", async () => {
      (prisma.product.findFirst as any).mockResolvedValue({
        id: "p1",
        name: "Casual Shirt",
        price: 35000,
        currency: "NGN",
        inventoryStatus: "IN_STOCK",
        variants: [],
      });

      (prisma.cart.create as any).mockResolvedValue({
        id: "cart_abc",
        sessionId,
        orgId,
        status: "ACTIVE",
        totalAmount: 0,
        currency: "NGN",
        items: [],
      });

      (prisma.cart.findFirst as any).mockResolvedValue({
        id: "cart_abc",
        sessionId,
        orgId,
        status: "ACTIVE",
        totalAmount: 35000,
        currency: "NGN",
        items: [
          {
            id: "item_1",
            productId: "p1",
            productName: "Casual Shirt",
            quantity: 1,
            unitPrice: 35000,
            totalPrice: 35000,
          },
        ],
      });

      (prisma.cart.update as any).mockResolvedValue({
        id: "cart_abc",
        sessionId,
        orgId,
        status: "ACTIVE",
        totalAmount: 35000,
        currency: "NGN",
        items: [
          {
            id: "item_1",
            productId: "p1",
            productName: "Casual Shirt",
            quantity: 1,
            unitPrice: 35000,
            totalPrice: 35000,
          },
        ],
      });

      const response = await CartEngine.addToCart({
        orgId,
        sessionId,
        productId: "p1",
        quantity: 1,
      });

      expect(response.success).toBe(true);
      expect(response.addedItem?.productName).toBe("Casual Shirt");
      expect(response.cart?.totalAmount).toBe(35000);
    });

    it("rejects add to cart if product is out of stock", async () => {
      (prisma.product.findFirst as any).mockResolvedValue({
        id: "p1",
        name: "Casual Shirt",
        price: 35000,
        currency: "NGN",
        inventoryStatus: "OUT_OF_STOCK",
        variants: [],
      });

      const response = await CartEngine.addToCart({
        orgId,
        sessionId,
        productId: "p1",
        quantity: 1,
      });

      expect(response.success).toBe(false);
      expect(response.errorMessage).toContain("unavailable");
    });
  });

  describe("C5 — Cart State Summary", () => {
    it("returns formatted cart items summary", async () => {
      (prisma.cart.findFirst as any).mockResolvedValue({
        id: "cart_abc",
        sessionId,
        orgId,
        status: "ACTIVE",
        totalAmount: 115000,
        currency: "NGN",
        items: [
          {
            id: "item_1",
            productId: "p1",
            productName: "Sneakers",
            quantity: 1,
            unitPrice: 80000,
            totalPrice: 80000,
          },
          {
            id: "item_2",
            productId: "p2",
            productName: "Shirt",
            quantity: 1,
            unitPrice: 35000,
            totalPrice: 35000,
          },
        ],
      });

      const summary = await CartEngine.getCartSummary(orgId, "cart_abc");
      expect(summary).toContain("Your Cart (2 items)");
      expect(summary).toContain("Sneakers");
      expect(summary).toContain("Shirt");
      expect(summary).toContain("115,000");
    });
  });

  describe("C6 — Intelligent Cart Assistance", () => {
    it("provides cross-sell recommendations excluding items already in cart", async () => {
      (prisma.product.findMany as any).mockResolvedValue([
        { id: "p3", name: "Leather Belt", price: 15000, currency: "NGN" },
      ]);

      const cart: any = {
        id: "cart_abc",
        items: [{ productId: "p1" }, { productId: "p2" }],
      };

      const recs = await CartAssistanceEngine.getCrossSellRecommendations(orgId, cart);
      expect(recs).toHaveLength(1);
      expect(recs[0].name).toBe("Leather Belt");
      expect(recs[0].reason).toContain("Pairs well");
    });
  });

  describe("C7, C8 — Checkout Handoff & Context Preservation", () => {
    it("prepares checkout URL with preserved context query params", async () => {
      (prisma.cart.findFirst as any).mockResolvedValue({
        id: "cart_abc",
        sessionId,
        orgId,
        status: "ACTIVE",
        totalAmount: 80000,
        currency: "NGN",
        items: [{ productId: "p1", quantity: 1, unitPrice: 80000, totalPrice: 80000 }],
      });

      (prisma.cart.update as any).mockResolvedValue({ id: "cart_abc" });

      (prisma.product.findFirst as any).mockResolvedValue({
        id: "p1",
        name: "Sneakers",
        price: 80000,
        currency: "NGN",
        inventoryStatus: "IN_STOCK",
        sourceUrl: "https://store.example.com/sneakers",
        variants: [],
      });

      (prisma.organization.findUnique as any).mockResolvedValue({
        id: orgId,
        settings: {},
      });

      const checkoutRes = await CheckoutHandoffEngine.prepareCheckout(orgId, "cart_abc", {
        sessionId,
        conversationId: "conv_999",
        merchantId: orgId,
      });

      expect(checkoutRes.checkoutUrl).toBeDefined();
      expect(checkoutRes.checkoutUrl).toContain("midevla_session_id=sess_test_123");
      expect(checkoutRes.checkoutUrl).toContain("midevla_conversation_id=conv_999");
      expect(checkoutRes.checkoutUrl).toContain("midevla_cart_id=cart_abc");
    });
  });

  describe("C13 — Checkout Failure Recovery", () => {
    it("suggests alternatives when requested item becomes unavailable", async () => {
      (prisma.product.findFirst as any).mockResolvedValue({
        categoryId: "cat_shoes",
        name: "Running Shoe",
      });

      (prisma.product.findMany as any).mockResolvedValue([
        { id: "p_alt1", name: "Trail Shoe", price: 75000, currency: "NGN" },
      ]);

      const recovery = await CheckoutRecoveryEngine.handleFailure(orgId, "p1", undefined, "Out of stock");

      expect(recovery.hasRecovery).toBe(true);
      expect(recovery.suggestedAlternatives).toHaveLength(1);
      expect(recovery.suggestedAlternatives?.[0].name).toBe("Trail Shoe");
    });
  });

  describe("C15 — Abandoned Cart Foundation", () => {
    it("records cart abandonment state in database", async () => {
      (prisma.cart.findFirst as any).mockResolvedValue({
        id: "cart_abc",
        totalAmount: 80000,
        items: [{ quantity: 1 }],
      });

      await AbandonedCartTracker.recordAbandonment({
        orgId,
        cartId: "cart_abc",
        sessionId,
      });

      expect(prisma.cart.update).toHaveBeenCalledWith({
        where: { id: "cart_abc" },
        data: { status: "ABANDONED" },
      });

      expect(prisma.abandonedCart.upsert).toHaveBeenCalled();
    });
  });

  describe("C16 — Smart Checkout Assistance", () => {
    it("answers policy questions from Website Intelligence layer", async () => {
      (prisma.knowledgeEntry.findMany as any).mockResolvedValue([
        {
          title: "Shipping Policy",
          content: "Free nationwide shipping on orders over ₦50,000.",
          type: "POLICY",
        },
      ]);

      const answer = await CheckoutAssistanceEngine.answerCheckoutQuestion(
        orgId,
        "How much is delivery?"
      );

      expect(answer).toContain("Free nationwide shipping");
    });
  });
});
