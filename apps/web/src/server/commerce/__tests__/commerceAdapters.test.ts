import { describe, it, expect, beforeEach, vi } from "vitest";
import { NativeMidevelaCommerceAdapter } from "../nativeAdapter";
import { ShopifyCommerceAdapter } from "../shopifyAdapter";
import { WooCommerceCommerceAdapter } from "../woocommerceAdapter";
import { CustomRestCommerceAdapter } from "../customRestAdapter";

vi.mock("@/lib/prisma", () => ({
  default: {
    product: {
      findFirst: vi.fn(),
    },
    productVariant: {
      findFirst: vi.fn(),
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
  },
}));

vi.mock("@/server/widget/checkoutHandler", () => ({
  generatePaymentLink: vi.fn().mockResolvedValue({
    paymentUrl: "https://checkout.paystack.com/test_123",
    isPaystack: true,
    productName: "Test Shoe",
    productPrice: "₦50,000",
  }),
}));

import prisma from "@/lib/prisma";

describe("Universal Commerce Adapters (Milestone C2)", () => {
  const orgId = "00000000-0000-0000-0000-000000000001";
  const productId = "11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("NativeMidevelaCommerceAdapter", () => {
    const adapter = new NativeMidevelaCommerceAdapter(orgId);

    it("has platform set to 'native'", () => {
      expect(adapter.platform).toBe("native");
    });

    it("retrieves product and maps details correctly", async () => {
      (prisma.product.findFirst as any).mockResolvedValue({
        id: productId,
        name: "Black Running Sneaker",
        brand: "Nike",
        description: "Lightweight running shoes",
        price: 85000,
        currency: "NGN",
        inventoryStatus: "IN_STOCK",
        sourceUrl: "https://store.example.com/shoes/running-black",
        images: ["https://store.example.com/shoe.jpg"],
        attributes: { color: "black" },
        variants: [
          {
            id: "v1",
            productId,
            sku: "SNEAKER-42",
            name: "Size 42",
            price: 85000,
            currency: "NGN",
            inventoryStatus: "IN_STOCK",
            inventoryQuantity: 10,
            attributes: { size: "42", color: "black" },
          },
        ],
      });

      const prod = await adapter.getProduct(productId);

      expect(prod).not.toBeNull();
      expect(prod?.name).toBe("Black Running Sneaker");
      expect(prod?.price).toBe(85000);
      expect(prod?.variants).toHaveLength(1);
      expect(prod?.variants?.[0].attributes.size).toBe("42");
    });

    it("checks availability accurately for available products", async () => {
      (prisma.product.findFirst as any).mockResolvedValue({
        id: productId,
        price: 85000,
        currency: "NGN",
        inventoryStatus: "IN_STOCK",
        variants: [],
      });

      const result = await adapter.getAvailability(productId);
      expect(result.isAvailable).toBe(true);
      expect(result.currentPrice).toBe(85000);
    });

    it("returns unavailable status when product is OUT_OF_STOCK", async () => {
      (prisma.product.findFirst as any).mockResolvedValue({
        id: productId,
        price: 85000,
        currency: "NGN",
        inventoryStatus: "OUT_OF_STOCK",
        variants: [],
      });

      const result = await adapter.getAvailability(productId);
      expect(result.isAvailable).toBe(false);
      expect(result.reason).toBe("Product out of stock");
    });

    it("creates a new cart for a session", async () => {
      (prisma.cart.create as any).mockResolvedValue({
        id: "cart_123",
        sessionId: "sess_456",
        status: "ACTIVE",
        totalAmount: 0,
        currency: "NGN",
        items: [],
      });

      const cart = await adapter.createCart("sess_456");
      expect(cart.id).toBe("cart_123");
      expect(cart.sessionId).toBe("sess_456");
      expect(cart.totalAmount).toBe(0);
    });
  });

  describe("Platform Adapters Fallback Behavior", () => {
    it("ShopifyCommerceAdapter falls back to native adapter when missing keys", async () => {
      const shopify = new ShopifyCommerceAdapter(orgId);
      expect(shopify.platform).toBe("shopify");

      (prisma.product.findFirst as any).mockResolvedValue({
        id: productId,
        name: "Shopify Sneaker",
        price: 50000,
        currency: "NGN",
        inventoryStatus: "IN_STOCK",
        variants: [],
      });

      const prod = await shopify.getProduct(productId);
      expect(prod?.name).toBe("Shopify Sneaker");
    });

    it("WooCommerceCommerceAdapter initializes correctly", () => {
      const woo = new WooCommerceCommerceAdapter(orgId, { storeUrl: "https://woo.example.com" });
      expect(woo.platform).toBe("woocommerce");
    });

    it("CustomRestCommerceAdapter initializes correctly", () => {
      const custom = new CustomRestCommerceAdapter(orgId, { baseUrl: "https://api.example.com" });
      expect(custom.platform).toBe("custom_rest");
    });
  });
});
